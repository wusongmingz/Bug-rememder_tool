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

function normalizeStatus(rawStatus, bug) {
  let status = (rawStatus || '').toString().trim().toLowerCase()

  // 处理中文/英文状态值
  if (status === 'active' || status === '激活') return 'active'
  if (status === 'resolved' || status === '已解决') return 'resolved'
  if (status === 'closed' || status === '已关闭') return 'closed'

  // status缺失时，从其他字段推断
  if (!status) {
    // 有解决日期/解决者/解决方案 → resolved
    if (bug.resolvedDate || bug.resolvedBy || bug.resolution) return 'resolved'
    // 否则才认定为 active
    return 'active'
  }

  // 未知状态值 → 视为 resolved（fail-closed，不计入活跃数）
  return 'resolved'
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
   * @param {object} bug - 原始bug对象
   * @param {object} usersMap - 用户名→真名映射表（可选）
   */
  mapBug(bug, usersMap = {}) {
    const assignedTo = bug.assignedTo || '未指派';
    // 优先使用 bug 自带的真名字段，其次用 usersMap 映射，最后回退到账号名
    const assignedToRealName = bug.assignedToRealName || bug.realname || usersMap[assignedTo] || assignedTo;
    return {
      id: Number(bug.id),
      title: bug.title || '',
      severity: mapSeverity(bug.severity),
      status: normalizeStatus(bug.status, bug),
      assignedTo: assignedTo,
      assignedToRealName: assignedToRealName,
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
   * 获取产品列表（名称+ID）
   * 用于设置面板中展示给用户勾选
   */
  async getProductList() {
    // 确保已登录
    if (!this.token && !this.sessionId) {
      await this.login();
    }

    try {
      const url = `${this.origin}${this.webRoot}/product-ajaxGetDropMenu-14-bug-browse-.html`;
      console.log('[ZentaoAPI] 获取产品列表:', url);
      const res = await this.request(url);

      let data = res.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch(e) { /* not JSON */ }
      }

      const products = [];
      const seenIds = new Set();

      if (data && data.data) {
        // 从 data.data.other 中提取
        if (data.data.other) {
          for (const group of data.data.other) {
            if (group.items) {
              for (const item of group.items) {
                const id = Number(item.id);
                if (id > 0 && !seenIds.has(id)) {
                  seenIds.add(id);
                  products.push({ id, name: item.text || item.name || `产品${id}` });
                }
              }
            }
          }
        }
        // 也检查 data.data.my
        if (data.data.my) {
          for (const item of data.data.my) {
            const id = Number(item.id);
            if (id > 0 && !seenIds.has(id)) {
              seenIds.add(id);
              products.push({ id, name: item.text || item.name || `产品${id}` });
            }
          }
        }
      }

      console.log('[ZentaoAPI] 获取到产品列表:', products.length, '个');
      return products;
    } catch (err) {
      console.error('[ZentaoAPI] getProductList failed:', err.message);
      return [];
    }
  }

  /**
   * 获取产品ID列表
   * 使用 product-ajaxGetDropMenu 接口获取所有产品
   */
  async getProductIds() {
    try {
      const url = `${this.origin}${this.webRoot}/product-ajaxGetDropMenu-14-bug-browse-.html`;
      console.log('[ZentaoAPI] 获取产品下拉菜单:', url);
      const res = await this.request(url);

      let data = res.data;
      if (typeof data === 'string') {
        // 可能返回HTML，尝试提取JSON
        try { data = JSON.parse(data); } catch(e) { /* not JSON */ }
      }

      const productIds = [];
      // 从 data.data.other 中提取所有产品
      if (data && data.data && data.data.other) {
        for (const group of data.data.other) {
          if (group.items) {
            for (const item of group.items) {
              productIds.push(Number(item.id));
            }
          }
        }
      }
      // 也检查 data.data.my
      if (data && data.data && data.data.my) {
        for (const item of data.data.my) {
          if (item.id) productIds.push(Number(item.id));
        }
      }

      const uniqueIds = [...new Set(productIds)].filter(id => id > 0);
      console.log('[ZentaoAPI] 从下拉菜单获取到产品ID:', uniqueIds);
      return uniqueIds;
    } catch (err) {
      console.error('[ZentaoAPI] getProductIds failed:', err.message);
      return [];
    }
  }

  /**
   * 按产品ID获取未关闭Bug
   * 返回 { bugs: [...], usersMap: {...} }
   */
  async getBugsByProduct(productId) {
    // 使用正确的路径格式：-all-unclosed，每页2000条确保覆盖大量数据
    const url = `${this.origin}${this.webRoot}/bug-browse-${productId}-all-unclosed-0-id_desc-0-2000.json`;
    console.log('[ZentaoAPI] 获取产品Bug:', url);

    try {
      const res = await this.request(url);

      if (res.statusCode !== 200 || !res.data) {
        console.log(`[ZentaoAPI] 产品${productId}请求失败, 状态:`, res.statusCode);
        return { bugs: [], usersMap: {} };
      }

      const result = res.data;
      let responseData = result;

      // 处理双重JSON编码
      if (result.status && result.data !== undefined) {
        let innerData = result.data;
        if (typeof innerData === 'string') {
          try { innerData = JSON.parse(innerData); } catch (e) {
            console.log(`[ZentaoAPI] 产品${productId} data解析失败:`, e.message);
          }
        }
        if (typeof innerData === 'object' && innerData !== null) {
          responseData = innerData;
        }
      }

      // 提取 users 映射表（用户名→真名）
      let usersMap = {};
      if (responseData.users && typeof responseData.users === 'object') {
        usersMap = responseData.users;
        console.log(`[ZentaoAPI] 产品${productId}获取到users映射:`, Object.keys(usersMap).length, '个用户');
      }
      // 有些版本字段名是 realNamePairs
      if (responseData.realNamePairs && typeof responseData.realNamePairs === 'object') {
        usersMap = { ...usersMap, ...responseData.realNamePairs };
      }

      // bugs是对象格式 {id: {...}}，需要转为数组
      let rawBugs = [];
      if (responseData.bugs) {
        let bugsData = responseData.bugs;
        if (typeof bugsData === 'string') {
          try { bugsData = JSON.parse(bugsData); } catch (e) { /* ignore */ }
        }
        if (Array.isArray(bugsData)) {
          rawBugs = bugsData;
        } else if (typeof bugsData === 'object') {
          rawBugs = Object.values(bugsData);
        }
      }

      console.log(`[ZentaoAPI] 产品${productId}获取到${rawBugs.length}个Bug`);
      // 打印第一条bug的完整结构用于诊断真名字段
      if (rawBugs.length > 0) {
        console.log(`[ZentaoAPI] 产品${productId}第一条Bug:`, JSON.stringify(rawBugs[0]).substring(0, 500));
      }

      return { bugs: rawBugs, usersMap };
    } catch (err) {
      console.error(`[ZentaoAPI] getBugsByProduct(${productId}) failed:`, err.message);
      return { bugs: [], usersMap: {} };
    }
  }

  /**
   * 获取所有未关闭Bug（不限制assignedTo）
   * @param {string|number[]} configProductId - 用户配置的产品ID（逗号分隔字符串或数字数组），留空则自动获取
   */
  async getAllBugs(configProductId) {
    // 确保已登录
    if (!this.token && !this.sessionId) {
      await this.login();
    }

    console.log('[ZentaoAPI] getAllBugs: 开始获取全部Bug...');

    // 1. 确定产品ID列表
    let productIds = [];

    // 如果传入的是数组（selectedProductIds），直接使用
    if (Array.isArray(configProductId) && configProductId.length > 0) {
      productIds = configProductId.filter(id => Number(id) > 0).map(Number);
      console.log('[ZentaoAPI] 使用勾选的产品ID列表:', productIds);
    }
    // 如果传入的是字符串（旧的productId配置）
    else if (configProductId && typeof configProductId === 'string' && configProductId.trim()) {
      productIds = configProductId.split(',').map(id => parseInt(id.trim())).filter(id => id > 0);
      console.log('[ZentaoAPI] 使用用户配置的产品ID:', productIds);
    }

    // 如果没有配置，尝试自动获取
    if (productIds.length === 0) {
      try {
        productIds = await this.getProductIds();
        console.log('[ZentaoAPI] 自动获取到产品ID列表:', productIds);
      } catch (e) {
        console.log('[ZentaoAPI] 自动获取产品列表失败:', e.message);
      }
    }

    // 如果仍然没有产品ID，尝试REST API全局查询作为后备
    if (productIds.length === 0 && this.token) {
      try {
        const url = `${this.origin}${this.webRoot}/api.php/v1/bugs?status=active&limit=200`;
        console.log('[ZentaoAPI] 尝试REST API全局获取Bug:', url);
        const res = await this.request(url);
        if (res.statusCode === 200) {
          const result = res.data;
          let rawBugs = [];
          if (result && result.bugs) {
            rawBugs = Array.isArray(result.bugs) ? result.bugs : (result.bugs.bugs || []);
          } else if (Array.isArray(result)) {
            rawBugs = result;
          }
          if (rawBugs.length > 0) {
            console.log('[ZentaoAPI] REST API全局获取到Bug数量:', rawBugs.length);
            return { bugs: rawBugs.map(bug => this.mapBug(bug)), usersMap: {} };
          }
        }
      } catch (err) {
        console.log('[ZentaoAPI] REST API全局获取Bug失败:', err.message);
      }
    }

    if (productIds.length === 0) {
      console.log('[ZentaoAPI] 无法获取产品列表，返回空');
      return { bugs: [], usersMap: {} };
    }

    // 2. 逐产品获取Bug，收集 usersMap
    let allRawBugs = [];
    let globalUsersMap = {};
    for (const pid of productIds) {
      try {
        const result = await this.getBugsByProduct(pid);
        allRawBugs = allRawBugs.concat(result.bugs);
        // 合并 usersMap
        if (result.usersMap) {
          globalUsersMap = { ...globalUsersMap, ...result.usersMap };
        }
      } catch (e) {
        console.log(`[ZentaoAPI] 产品${pid}获取Bug失败:`, e.message);
      }
    }

    console.log('[ZentaoAPI] 全局usersMap:', Object.keys(globalUsersMap).length, '个用户');

    // 3. 映射为标准格式（传入usersMap做真名映射）
    const allBugs = allRawBugs.map(bug => this.mapBug(bug, globalUsersMap));

    // 4. 去重（多个产品可能有重复Bug）
    const bugMap = new Map();
    for (const bug of allBugs) {
      bugMap.set(bug.id, bug);
    }
    const uniqueBugs = Array.from(bugMap.values());

    const statusCounts = { active: 0, resolved: 0, other: 0 }
    uniqueBugs.forEach(b => {
      if (b.status === 'active') statusCounts.active++
      else if (b.status === 'resolved') statusCounts.resolved++
      else statusCounts.other++
    })
    console.log('[ZentaoAPI] getAllBugs 统计:', statusCounts, '总计:', uniqueBugs.length)

    console.log('[ZentaoAPI] 全部Bug总数:', uniqueBugs.length);
    return { bugs: uniqueBugs, usersMap: globalUsersMap };
  }

  /**
   * 转指派Bug给其他人
   * @param {number} bugId - Bug ID
   * @param {string} assignedTo - 目标人员账号名（account，非真名）
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async assignBug(bugId, assignedTo) {
    // 确保已登录
    if (!this.token && !this.sessionId) {
      await this.login();
    }

    try {
      // 禅道20.8 REST API v1: PUT /api.php/v1/bugs/{id}
      const url = `${this.origin}${this.webRoot}/api.php/v1/bugs/${bugId}`;
      console.log(`[ZentaoAPI] 转指派Bug #${bugId} 给 ${assignedTo}`);

      const res = await this.request(url, {
        method: 'PUT',
        body: { assignedTo },
      });

      if (res.statusCode === 200 || res.statusCode === 201) {
        console.log(`[ZentaoAPI] Bug #${bugId} 已转指派给 ${assignedTo}`);
        return { success: true, data: res.data };
      }

      // Token过期重试
      if (res.statusCode === 401 && !this._assignRetried) {
        this._assignRetried = true;
        console.log('[ZentaoAPI] Token过期, 重新登录后重试转指派...');
        this.token = null;
        await this.login();
        const result = await this.assignBug(bugId, assignedTo);
        this._assignRetried = false;
        return result;
      }

      const errorMsg = res.data?.error || res.data?.message || `HTTP ${res.statusCode}`;
      console.error(`[ZentaoAPI] 转指派失败: ${errorMsg}`);
      return { success: false, error: errorMsg };
    } catch (error) {
      console.error(`[ZentaoAPI] 转指派异常:`, error.message);

      // 网络异常时也尝试重新登录重试一次
      if (!this._assignRetried) {
        this._assignRetried = true;
        try {
          await this.login();
          const result = await this.assignBug(bugId, assignedTo);
          this._assignRetried = false;
          return result;
        } catch (retryError) {
          this._assignRetried = false;
          return { success: false, error: retryError.message };
        }
      }

      return { success: false, error: error.message };
    }
  }
}

module.exports = ZentaoAPI;
