/**
 * 禅道API封装模块
 * 支持登录、获取指派给我的Bug列表
 * 兼容禅道18.x+ REST API v1 和旧版 session + JSON 接口
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// severity 数字 → 字符串映射
const SEVERITY_MAP = {
  1: 'fatal',
  2: 'critical',
  3: 'normal',
  4: 'suggestion',
};

function mapSeverity(val) {
  if (typeof val === 'string' && ['fatal', 'critical', 'normal', 'suggestion'].includes(val)) {
    return val;
  }
  return SEVERITY_MAP[Number(val)] || 'normal';
}

class ZentaoAPI {
  constructor(baseUrl, account, password) {
    // 去掉末尾斜杠
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.account = account;
    this.password = password;
    this.sessionId = null;
    this.token = null;
    this.cookie = '';
    this._retried = false;

    // 解析webRoot: 如果baseUrl包含路径部分（如 /zentao），提取出来
    try {
      const parsed = new URL(this.baseUrl);
      this.origin = parsed.origin; // http://host:port
      this.webRoot = parsed.pathname.replace(/\/$/, ''); // /zentao 或 空
    } catch (e) {
      this.origin = this.baseUrl;
      this.webRoot = '';
    }

    console.log('[ZentaoAPI] 初始化:', {
      baseUrl: this.baseUrl,
      origin: this.origin,
      webRoot: this.webRoot,
      account: this.account,
    });
  }

  /**
   * 发起HTTP请求
   */
  request(urlStr, options = {}) {
    return new Promise((resolve, reject) => {
      console.log(`[ZentaoAPI] ${options.method || 'GET'} ${urlStr}`);
      const url = new URL(urlStr);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;

      const reqOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
      };

      if (this.token) {
        reqOptions.headers['Token'] = this.token;
      }
      if (this.cookie) {
        reqOptions.headers['Cookie'] = this.cookie;
      }

      const req = lib.request(reqOptions, (res) => {
        // 保存cookie
        const setCookies = res.headers['set-cookie'];
        if (setCookies) {
          const cookies = setCookies.map(c => c.split(';')[0]).join('; ');
          this.cookie = cookies;
        }

        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          console.log(`[ZentaoAPI] 响应状态: ${res.statusCode}, 数据长度: ${data.length}`);
          try {
            const json = JSON.parse(data);
            resolve({ statusCode: res.statusCode, data: json });
          } catch (e) {
            resolve({ statusCode: res.statusCode, data: data });
          }
        });
      });

      req.on('error', (err) => {
        console.error('[ZentaoAPI] 请求错误:', err.message);
        reject(err);
      });
      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('请求超时'));
      });

      if (options.body) {
        const bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
        reqOptions.headers['Content-Length'] = Buffer.byteLength(bodyStr);
        req.write(bodyStr);
      }
      req.end();
    });
  }

  /**
   * 登录禅道获取Token
   * 优先尝试 REST API v1 token，然后尝试旧版 session 登录
   */
  async login() {
    console.log('[ZentaoAPI] 开始登录, baseUrl:', this.baseUrl);

    // 策略1: REST API v1 token方式 (禅道18.x+)
    // URL: {origin}{webRoot}/api.php/v1/tokens
    try {
      const tokenUrl = `${this.origin}${this.webRoot}/api.php/v1/tokens`;
      console.log('[ZentaoAPI] 尝试REST API v1登录:', tokenUrl);
      const res = await this.request(tokenUrl, {
        method: 'POST',
        body: { account: this.account, password: this.password },
      });

      if (res.statusCode === 200 || res.statusCode === 201) {
        const result = res.data;
        if (result && result.token) {
          this.token = result.token;
          console.log('[ZentaoAPI] REST API v1 token登录成功');
          return true;
        }
      }
      console.log('[ZentaoAPI] REST API v1 token登录未成功, 状态:', res.statusCode, '响应:', JSON.stringify(res.data).substring(0, 200));
    } catch (err) {
      console.log('[ZentaoAPI] REST API v1登录请求失败:', err.message);
    }

    // 策略2: 旧版 session 方式 - PATH_INFO 模式
    // URL: {origin}{webRoot}/user-login.json
    try {
      const sessionUrl = `${this.origin}${this.webRoot}/user-login.json`;
      console.log('[ZentaoAPI] 尝试旧版session登录(PATH_INFO):', sessionUrl);
      const res = await this.request(sessionUrl, {
        method: 'POST',
        body: { account: this.account, password: this.password },
      });

      if (res.statusCode === 200 || res.statusCode === 302) {
        const result = res.data;
        // 旧版登录成功后依靠cookie维持session
        if (result && (result.user || result.status === 'success' || this.cookie)) {
          console.log('[ZentaoAPI] 旧版session登录成功(依靠cookie)');
          this.sessionId = 'cookie-session';
          return true;
        }
      }
      console.log('[ZentaoAPI] 旧版session登录未成功, 状态:', res.statusCode);
    } catch (err) {
      console.log('[ZentaoAPI] 旧版session登录请求失败:', err.message);
    }

    // 策略3: 另一种旧版API路径
    // URL: {origin}{webRoot}/index.php?m=user&f=login&t=json
    try {
      const altUrl = `${this.origin}${this.webRoot}/index.php?m=user&f=login&t=json`;
      console.log('[ZentaoAPI] 尝试旧版query登录:', altUrl);
      const res = await this.request(altUrl, {
        method: 'POST',
        body: { account: this.account, password: this.password },
      });

      if (res.statusCode === 200) {
        const result = res.data;
        if (result && (result.user || result.status === 'success' || this.cookie)) {
          console.log('[ZentaoAPI] 旧版query登录成功');
          this.sessionId = 'cookie-session';
          return true;
        }
      }
      console.log('[ZentaoAPI] 旧版query登录未成功, 状态:', res.statusCode);
    } catch (err) {
      console.log('[ZentaoAPI] 旧版query登录请求失败:', err.message);
    }

    throw new Error('所有登录方式均失败，请检查禅道地址、账号和密码是否正确');
  }

  /**
   * 将禅道原始Bug数据映射为标准格式
   */
  mapBug(bug) {
    return {
      id: Number(bug.id),
      title: bug.title || '',
      severity: mapSeverity(bug.severity),
      status: bug.status || 'active',
      assignedTo: bug.assignedTo || bug.assignedToRealName || this.account,
      createdDate: bug.openedDate || bug.createdDate || bug.openedBy || '',
      resolvedDate: bug.resolvedDate || bug.closedDate || undefined,
    };
  }

  /**
   * 获取指派给我的Bug列表
   */
  async getMyBugs() {
    // 确保已登录
    if (!this.token && !this.sessionId) {
      await this.login();
    }

    console.log('[ZentaoAPI] 开始获取Bug列表...');

    // 策略1: REST API v1 (禅道18.x+)
    if (this.token) {
      try {
        const url = `${this.origin}${this.webRoot}/api.php/v1/bugs?assignedTo=${this.account}&status=active&limit=100`;
        console.log('[ZentaoAPI] REST API获取Bug:', url);
        const res = await this.request(url);

        if (res.statusCode === 200) {
          const result = res.data;
          console.log('[ZentaoAPI] REST API响应类型:', typeof result, Array.isArray(result) ? '(数组)' : '');

          // 禅道18.x返回 { bugs: [...] } 或 { bugs: { total, page, bugs: [...] } }
          let rawBugs = [];
          if (result && result.bugs) {
            rawBugs = Array.isArray(result.bugs) ? result.bugs : (result.bugs.bugs || []);
          } else if (Array.isArray(result)) {
            rawBugs = result;
          }

          console.log('[ZentaoAPI] REST API获取到Bug数量:', rawBugs.length);
          if (rawBugs.length > 0) {
            console.log('[ZentaoAPI] 第一条Bug原始数据:', JSON.stringify(rawBugs[0]).substring(0, 300));
          }
          return rawBugs.map(bug => this.mapBug(bug));
        }

        // Token可能过期
        if (res.statusCode === 401) {
          console.log('[ZentaoAPI] Token过期, 重新登录...');
          this.token = null;
          if (!this._retried) {
            this._retried = true;
            await this.login();
            const bugs = await this.getMyBugs();
            this._retried = false;
            return bugs;
          }
        }
      } catch (err) {
        console.error('[ZentaoAPI] REST API获取Bug失败:', err.message);
      }
    }

    // 策略2: 旧版 PATH_INFO 方式 - /zentao/my-bug.json
    try {
      const url = `${this.origin}${this.webRoot}/my-bug.json`;
      console.log('[ZentaoAPI] 旧版PATH_INFO获取Bug:', url);
      const res = await this.request(url);

      if (res.statusCode === 200 && res.data) {
        const result = res.data;
        console.log('[ZentaoAPI] 旧版响应keys:', Object.keys(result || {}));

        // 处理双重JSON编码：禅道.json接口的data字段可能是JSON字符串
        let responseData = result;
        if (result.status && result.data !== undefined) {
          let innerData = result.data;
          console.log('[ZentaoAPI] result.data类型:', typeof innerData, String(innerData).substring(0, 100));
          if (typeof innerData === 'string') {
            try {
              innerData = JSON.parse(innerData);
              console.log('[ZentaoAPI] data字段二次JSON解析成功, keys:', Object.keys(innerData || {}));
            } catch (e) {
              console.log('[ZentaoAPI] data字段JSON解析失败:', e.message);
            }
          }
          if (typeof innerData === 'object' && innerData !== null) {
            responseData = innerData;
          }
        }

        // bugs可能是对象格式（以ID为key），需要转为数组
        let rawBugs = [];
        if (responseData.bugs) {
          const bugsData = responseData.bugs;
          if (Array.isArray(bugsData)) {
            rawBugs = bugsData;
          } else if (typeof bugsData === 'object') {
            rawBugs = Object.values(bugsData);
          }
        } else if (result.bugs) {
          // 兼容：顶层直接有bugs字段的情况
          rawBugs = Array.isArray(result.bugs) ? result.bugs : Object.values(result.bugs);
        }

        console.log('[ZentaoAPI] 旧版获取到Bug数量:', rawBugs.length);
        if (rawBugs.length > 0) {
          console.log('[ZentaoAPI] 第一条Bug原始数据:', JSON.stringify(rawBugs[0]).substring(0, 300));
          return rawBugs.map(bug => this.mapBug(bug));
        }
      }
    } catch (err) {
      console.log('[ZentaoAPI] 旧版PATH_INFO获取Bug失败:', err.message);
    }

    // 策略3: 旧版 query 方式
    try {
      const url = `${this.origin}${this.webRoot}/index.php?m=my&f=bug&t=json`;
      console.log('[ZentaoAPI] 旧版query获取Bug:', url);
      const res = await this.request(url);

      if (res.statusCode === 200 && res.data) {
        const result = res.data;

        // 处理双重JSON编码：同策略2
        let responseData = result;
        if (result.status && result.data !== undefined) {
          let innerData = result.data;
          console.log('[ZentaoAPI] query result.data类型:', typeof innerData, String(innerData).substring(0, 100));
          if (typeof innerData === 'string') {
            try {
              innerData = JSON.parse(innerData);
              console.log('[ZentaoAPI] query data字段二次JSON解析成功, keys:', Object.keys(innerData || {}));
            } catch (e) {
              console.log('[ZentaoAPI] query data字段JSON解析失败:', e.message);
            }
          }
          if (typeof innerData === 'object' && innerData !== null) {
            responseData = innerData;
          }
        }

        // bugs可能是对象格式（以ID为key），需要转为数组
        let rawBugs = [];
        if (responseData.bugs) {
          const bugsData = responseData.bugs;
          if (Array.isArray(bugsData)) {
            rawBugs = bugsData;
          } else if (typeof bugsData === 'object') {
            rawBugs = Object.values(bugsData);
          }
        } else if (Array.isArray(responseData)) {
          rawBugs = responseData;
        }

        console.log('[ZentaoAPI] 旧版query获取到Bug数量:', rawBugs.length);
        if (rawBugs.length > 0) {
          console.log('[ZentaoAPI] 第一条Bug原始数据:', JSON.stringify(rawBugs[0]).substring(0, 300));
          return rawBugs.map(bug => this.mapBug(bug));
        }
      }
    } catch (err) {
      console.log('[ZentaoAPI] 旧版query获取Bug失败:', err.message);
    }

    console.log('[ZentaoAPI] 所有方式均未获取到Bug数据');
    return [];
  }

  /**
   * 获取所有未关闭Bug（不限制assignedTo）
   */
  async getAllBugs() {
    // 确保已登录
    if (!this.token && !this.sessionId) {
      await this.login();
    }

    console.log('[ZentaoAPI] 开始获取所有Bug列表...');

    // 策略1: REST API v1 - 不传assignedTo
    if (this.token) {
      try {
        const url = `${this.origin}${this.webRoot}/api.php/v1/bugs?status=active&limit=200`;
        console.log('[ZentaoAPI] REST API获取所有Bug:', url);
        const res = await this.request(url);

        if (res.statusCode === 200) {
          const result = res.data;
          let rawBugs = [];
          if (result && result.bugs) {
            rawBugs = Array.isArray(result.bugs) ? result.bugs : (result.bugs.bugs || []);
          } else if (Array.isArray(result)) {
            rawBugs = result;
          }
          console.log('[ZentaoAPI] REST API获取到所有Bug数量:', rawBugs.length);
          if (rawBugs.length > 0) {
            return rawBugs.map(bug => this.mapBug(bug));
          }
        }

        if (res.statusCode === 401) {
          console.log('[ZentaoAPI] Token过期, 重新登录...');
          this.token = null;
          await this.login();
          return this.getAllBugs();
        }
      } catch (err) {
        console.error('[ZentaoAPI] REST API获取所有Bug失败:', err.message);
      }
    }

    // 策略2: 旧版 PATH_INFO - /zentao/bug-browse-0-0-unclosed.json
    try {
      const url = `${this.origin}${this.webRoot}/bug-browse-0-0-unclosed.json`;
      console.log('[ZentaoAPI] 旧版PATH_INFO获取所有Bug:', url);
      const res = await this.request(url);

      if (res.statusCode === 200 && res.data) {
        const result = res.data;
        let responseData = result;
        if (result.status && result.data !== undefined) {
          let innerData = result.data;
          if (typeof innerData === 'string') {
            try {
              innerData = JSON.parse(innerData);
            } catch (e) {
              console.log('[ZentaoAPI] getAllBugs data字段JSON解析失败:', e.message);
            }
          }
          if (typeof innerData === 'object' && innerData !== null) {
            responseData = innerData;
          }
        }

        let rawBugs = [];
        if (responseData.bugs) {
          const bugsData = responseData.bugs;
          if (Array.isArray(bugsData)) {
            rawBugs = bugsData;
          } else if (typeof bugsData === 'object') {
            rawBugs = Object.values(bugsData);
          }
        }

        console.log('[ZentaoAPI] 旧版获取到所有Bug数量:', rawBugs.length);
        if (rawBugs.length > 0) {
          return rawBugs.map(bug => this.mapBug(bug));
        }
      }
    } catch (err) {
      console.log('[ZentaoAPI] 旧版PATH_INFO获取所有Bug失败:', err.message);
    }

    // 策略3: 旧版 query 方式
    try {
      const url = `${this.origin}${this.webRoot}/index.php?m=bug&f=browse&productID=0&branch=0&browseType=unclosed&t=json`;
      console.log('[ZentaoAPI] 旧版query获取所有Bug:', url);
      const res = await this.request(url);

      if (res.statusCode === 200 && res.data) {
        const result = res.data;
        let responseData = result;
        if (result.status && result.data !== undefined) {
          let innerData = result.data;
          if (typeof innerData === 'string') {
            try {
              innerData = JSON.parse(innerData);
            } catch (e) {
              console.log('[ZentaoAPI] getAllBugs query data解析失败:', e.message);
            }
          }
          if (typeof innerData === 'object' && innerData !== null) {
            responseData = innerData;
          }
        }

        let rawBugs = [];
        if (responseData.bugs) {
          const bugsData = responseData.bugs;
          if (Array.isArray(bugsData)) {
            rawBugs = bugsData;
          } else if (typeof bugsData === 'object') {
            rawBugs = Object.values(bugsData);
          }
        } else if (Array.isArray(responseData)) {
          rawBugs = responseData;
        }

        console.log('[ZentaoAPI] 旧版query获取到所有Bug数量:', rawBugs.length);
        if (rawBugs.length > 0) {
          return rawBugs.map(bug => this.mapBug(bug));
        }
      }
    } catch (err) {
      console.log('[ZentaoAPI] 旧版query获取所有Bug失败:', err.message);
    }

    console.log('[ZentaoAPI] 所有方式均未获取到全部Bug数据');
    return [];
  }
}

module.exports = ZentaoAPI;
