'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Admin = exports.MongoClient = exports.BaasClient = exports.Auth = exports.BaasError = exports.parseRedirectFragment = exports.ErrInvalidSession = exports.ErrAuthProviderNotFound = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

require('whatwg-fetch');

var _textEncoding = require('text-encoding');

var textEncodingPolyfill = _interopRequireWildcard(_textEncoding);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /* global window, localStorage, fetch */
/* eslint no-labels: ['error', { 'allowLoop': true }] */
// fetch polyfill


// TextEncoder polyfill

var USER_AUTH_KEY = '_baas_ua';
var REFRESH_TOKEN_KEY = '_baas_rt';
var STATE_KEY = '_baas_state';
var BAAS_ERROR_KEY = '_baas_error';
var BAAS_LINK_KEY = '_baas_link';
var IMPERSONATION_ACTIVE_KEY = '_baas_impers_active';
var IMPERSONATION_USER_KEY = '_baas_impers_user';
var IMPERSONATION_REAL_USER_AUTH_KEY = '_baas_impers_real_ua';
var DEFAULT_BAAS_SERVER_URL = 'https://baas-dev.10gen.cc';
var JSONTYPE = 'application/json';

var ErrAuthProviderNotFound = exports.ErrAuthProviderNotFound = 'AuthProviderNotFound';
var ErrInvalidSession = exports.ErrInvalidSession = 'InvalidSession';
var stateLength = 64;

var TextDecoder = textEncodingPolyfill.TextDecoder;
if (typeof window !== 'undefined' && window.TextEncoder !== undefined && window.TextDecoder !== undefined) {
  TextDecoder = window.TextDecoder;
}

var toQueryString = function toQueryString(obj) {
  var parts = [];
  for (var i in obj) {
    if (obj.hasOwnProperty(i)) {
      parts.push(encodeURIComponent(i) + '=' + encodeURIComponent(obj[i]));
    }
  }
  return parts.join('&');
};

var checkStatus = function checkStatus(response) {
  if (response.status >= 200 && response.status < 300) {
    return response;
  } else {
    var error = new Error(response.statusText);
    error.response = response;
    throw error;
  }
};

var parseRedirectFragment = exports.parseRedirectFragment = function parseRedirectFragment(fragment, ourState) {
  // After being redirected from oauth, the URL will look like:
  // https://todo.examples.baas-dev.10gen.cc/#_baas_state=...&_baas_ua=...
  // This function parses out baas-specific tokens from the fragment and
  // builds an object describing the result.
  var vars = fragment.split('&');
  var result = { ua: null, found: false, stateValid: false, lastError: null };
  var shouldBreak = false;
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = vars[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var pair = _step.value;

      var pairParts = pair.split('=');
      var pairKey = decodeURIComponent(pairParts[0]);
      switch (pairKey) {
        case BAAS_ERROR_KEY:
          result.lastError = decodeURIComponent(pairParts[1]);
          result.found = true;
          shouldBreak = true;
          break;
        case USER_AUTH_KEY:
          result.ua = JSON.parse(window.atob(decodeURIComponent(pairParts[1])));
          result.found = true;
          continue;
        case BAAS_LINK_KEY:
          result.found = true;
          continue;
        case STATE_KEY:
          result.found = true;
          var theirState = decodeURIComponent(pairParts[1]);
          if (ourState && ourState === theirState) {
            result.stateValid = true;
          }
      }
      if (shouldBreak) {
        break;
      }
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  return result;
};

var BaasError = exports.BaasError = function (_Error) {
  _inherits(BaasError, _Error);

  function BaasError(message, code) {
    _classCallCheck(this, BaasError);

    var _this = _possibleConstructorReturn(this, (BaasError.__proto__ || Object.getPrototypeOf(BaasError)).call(this, message));

    _this.name = 'BaasError';
    _this.message = message;
    if (code !== undefined) {
      _this.code = code;
    }
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(_this, _this.constructor);
    } else {
      _this.stack = new Error(message).stack;
    }
    return _this;
  }

  return BaasError;
}(Error);

var Auth = exports.Auth = function () {
  function Auth(rootUrl) {
    _classCallCheck(this, Auth);

    this.rootUrl = rootUrl;
  }

  _createClass(Auth, [{
    key: 'pageRootUrl',
    value: function pageRootUrl() {
      return [window.location.protocol, '//', window.location.host, window.location.pathname].join('');
    }

    // The state we generate is to be used for any kind of request where we will
    // complete an authentication flow via a redirect. We store the generate in
    // a local storage bound to the app's origin. This ensures that any time we
    // receive a redirect, there must be a state parameter and it must match
    // what we ourselves have generated. This state MUST only be sent to
    // a trusted BaaS endpoint in order to preserve its integrity. BaaS will
    // store it in some way on its origin (currently a cookie stored on this client)
    // and use that state at the end of an auth flow as a parameter in the redirect URI.

  }, {
    key: 'setAccessToken',
    value: function setAccessToken(token) {
      var currAuth = this.get();
      currAuth['accessToken'] = token;
      currAuth['refreshToken'] = localStorage.getItem(REFRESH_TOKEN_KEY);
      this.set(currAuth);
    }
  }, {
    key: 'error',
    value: function error() {
      return this._error;
    }
  }, {
    key: 'handleRedirect',
    value: function handleRedirect() {
      var ourState = localStorage.getItem(STATE_KEY);
      var redirectFragment = window.location.hash.substring(1);
      var redirectState = parseRedirectFragment(redirectFragment, ourState);
      if (redirectState.lastError) {
        console.error('BaasClient: error from redirect: ' + redirectState.lastError);
        this._error = redirectState.lastError;
        window.history.replaceState(null, '', this.pageRootUrl());
        return;
      }
      if (!redirectState.found) {
        return;
      }
      localStorage.removeItem(STATE_KEY);
      if (!redirectState.stateValid) {
        console.error('BaasClient: state values did not match!');
        window.history.replaceState(null, '', this.pageRootUrl());
        return;
      }
      if (!redirectState.ua) {
        console.error('BaasClient: no UA value was returned from redirect!');
        return;
      }
      // If we get here, the state is valid - set auth appropriately.
      this.set(redirectState.ua);
      window.history.replaceState(null, '', this.pageRootUrl());
    }
  }, {
    key: 'getOAuthLoginURL',
    value: function getOAuthLoginURL(providerName, redirectUrl) {
      if (redirectUrl === undefined) {
        redirectUrl = this.pageRootUrl();
      }
      var state = Auth.generateState();
      localStorage.setItem(STATE_KEY, state);
      var result = this.rootUrl + '/oauth2/' + providerName + '?redirect=' + encodeURI(redirectUrl) + '&state=' + state;
      return result;
    }
  }, {
    key: 'anonymousAuth',
    value: function anonymousAuth(cors) {
      var _this2 = this;

      var init = {
        method: 'GET',
        headers: {
          'Accept': JSONTYPE,
          'Content-Type': JSONTYPE
        }
      };

      // TODO get rid of the cors flag. it should just be on all the time.
      if (cors) {
        init['cors'] = cors;
      }

      return fetch(this.rootUrl + '/anon/user', init).then(checkStatus).then(function (response) {
        return response.json().then(function (json) {
          _this2.set(json);
          Promise.resolve();
        });
      });
    }
  }, {
    key: 'localAuth',
    value: function localAuth(username, password, cors) {
      var _this3 = this;

      var init = {
        method: 'POST',
        headers: {
          'Accept': JSONTYPE,
          'Content-Type': JSONTYPE
        },
        body: JSON.stringify({ 'username': username, 'password': password })
      };

      if (cors) {
        init['cors'] = cors;
      }

      return fetch(this.rootUrl + '/local/userpass', init).then(checkStatus).then(function (response) {
        return response.json().then(function (json) {
          _this3.set(json);
          Promise.resolve();
        });
      });
    }
  }, {
    key: 'clear',
    value: function clear() {
      localStorage.removeItem(USER_AUTH_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      this.clearImpersonation();
    }
  }, {
    key: 'set',
    value: function set(json) {
      var rt = json['refreshToken'];
      delete json['refreshToken'];

      localStorage.setItem(USER_AUTH_KEY, window.btoa(JSON.stringify(json)));
      localStorage.setItem(REFRESH_TOKEN_KEY, rt);
    }
  }, {
    key: 'get',
    value: function get() {
      if (localStorage.getItem(USER_AUTH_KEY) === null) {
        return null;
      }
      return JSON.parse(window.atob(localStorage.getItem(USER_AUTH_KEY)));
    }
  }, {
    key: 'authedId',
    value: function authedId() {
      var id = ((this.get() || {}).user || {})._id;
      if (id) {
        return { '$oid': id };
      }
    }
  }, {
    key: 'isImpersonatingUser',
    value: function isImpersonatingUser() {
      return localStorage.getItem(IMPERSONATION_ACTIVE_KEY) === 'true';
    }
  }, {
    key: 'refreshImpersonation',
    value: function refreshImpersonation(client) {
      var _this4 = this;

      var userId = localStorage.getItem(IMPERSONATION_USER_KEY);
      return client._doAuthed('/admin/users/' + userId + '/impersonate', 'POST', { refreshOnFailure: false, useRefreshToken: true }).then(function (response) {
        return response.json().then(function (json) {
          json['refreshToken'] = localStorage.getItem(REFRESH_TOKEN_KEY);
          _this4.set(json);
          return Promise.resolve();
        });
      }).catch(function (e) {
        _this4.stopImpersonation();
        throw e;
      });
    }
  }, {
    key: 'startImpersonation',
    value: function startImpersonation(client, userId) {
      if (this.get() === null) {
        return Promise.reject(new BaasError('Must auth first'));
      }
      if (this.isImpersonatingUser()) {
        throw new BaasError('Already impersonating a user');
      }
      localStorage.setItem(IMPERSONATION_ACTIVE_KEY, 'true');
      localStorage.setItem(IMPERSONATION_USER_KEY, userId);

      var realUserAuth = JSON.parse(window.atob(localStorage.getItem(USER_AUTH_KEY)));
      realUserAuth['refreshToken'] = localStorage.getItem(REFRESH_TOKEN_KEY);
      localStorage.setItem(IMPERSONATION_REAL_USER_AUTH_KEY, window.btoa(JSON.stringify(realUserAuth)));
      return this.refreshImpersonation(client);
    }
  }, {
    key: 'stopImpersonation',
    value: function stopImpersonation() {
      var root = this;
      return new Promise(function (resolve, reject) {
        if (!root.isImpersonatingUser()) {
          throw new BaasError('Not impersonating a user');
        }
        var realUserAuth = JSON.parse(window.atob(localStorage.getItem(IMPERSONATION_REAL_USER_AUTH_KEY)));
        root.set(realUserAuth);
        root.clearImpersonation();
        resolve();
      });
    }
  }, {
    key: 'clearImpersonation',
    value: function clearImpersonation() {
      localStorage.removeItem(IMPERSONATION_ACTIVE_KEY);
      localStorage.removeItem(IMPERSONATION_USER_KEY);
      localStorage.removeItem(IMPERSONATION_REAL_USER_AUTH_KEY);
    }
  }], [{
    key: 'generateState',
    value: function generateState() {
      var alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      var state = '';
      for (var i = 0; i < stateLength; i++) {
        var pos = Math.floor(Math.random() * alpha.length);
        state += alpha.substring(pos, pos + 1);
      }
      return state;
    }
  }]);

  return Auth;
}();

var BaasClient = exports.BaasClient = function () {
  function BaasClient(clientAppID, options) {
    _classCallCheck(this, BaasClient);

    var baseUrl = DEFAULT_BAAS_SERVER_URL;
    if (options && options.baseUrl) {
      baseUrl = options.baseUrl;
    }
    this.appUrl = baseUrl + '/admin/v1';
    this.authUrl = baseUrl + '/admin/v1/auth';
    if (clientAppID) {
      this.appUrl = baseUrl + '/v1/app/' + clientAppID;
      this.authUrl = this.appUrl + '/auth';
    }
    this.authManager = new Auth(this.authUrl);
    this.authManager.handleRedirect();
  }

  _createClass(BaasClient, [{
    key: 'authWithOAuth',
    value: function authWithOAuth(providerName, redirectUrl) {
      window.location.replace(this.authManager.getOAuthLoginURL(providerName, redirectUrl));
    }
  }, {
    key: 'authedId',
    value: function authedId() {
      return this.authManager.authedId();
    }
  }, {
    key: 'auth',
    value: function auth() {
      return this.authManager.get();
    }
  }, {
    key: 'authError',
    value: function authError() {
      return this.authManager.error();
    }
  }, {
    key: 'logout',
    value: function logout() {
      var _this5 = this;

      return this._doAuthed('/auth', 'DELETE', { refreshOnFailure: false, useRefreshToken: true }).then(function (data) {
        _this5.authManager.clear();
      });
    }

    // wrapper around fetch() that matches the signature of doAuthed but does not
    // actually use any auth. This is necessary for routes that must be
    // accessible without logging in, like listing available auth providers.

  }, {
    key: '_do',
    value: function _do(resource, method, options) {
      options = options || {};
      var url = '' + this.appUrl + resource;
      var init = {
        method: method,
        headers: { 'Accept': JSONTYPE, 'Content-Type': JSONTYPE }
      };
      if (options.body) {
        init['body'] = options.body;
      }
      if (options.queryParams) {
        url = url + '?' + toQueryString(options.queryParams);
      }

      return fetch(url, init).then(function (response) {
        // Okay: passthrough
        if (response.status >= 200 && response.status < 300) {
          return Promise.resolve(response);
        } else if (response.headers.get('Content-Type') === JSONTYPE) {
          return response.json().then(function (json) {
            var error = new BaasError(json['error'], json['errorCode']);
            error.response = response;
            throw error;
          });
        }
        var error = new Error(response.statusText);
        error.response = response;
        throw error;
      }).then(function (response) {
        return response.json();
      });
    }
  }, {
    key: '_doAuthed',
    value: function _doAuthed(resource, method, options) {
      var _this6 = this;

      if (options === undefined) {
        options = { refreshOnFailure: true, useRefreshToken: false };
      } else {
        if (options.refreshOnFailure === undefined) {
          options.refreshOnFailure = true;
        }
        if (options.useRefreshToken === undefined) {
          options.useRefreshToken = false;
        }
      }

      if (this.auth() === null) {
        return Promise.reject(new BaasError('Must auth first'));
      }

      var url = '' + this.appUrl + resource;

      var headers = {
        'Accept': JSONTYPE,
        'Content-Type': JSONTYPE
      };
      var token = options.useRefreshToken ? localStorage.getItem(REFRESH_TOKEN_KEY) : this.auth()['accessToken'];
      headers['Authorization'] = 'Bearer ' + token;

      var init = {
        method: method,
        headers: headers
      };

      if (options.body) {
        init['body'] = options.body;
      }

      if (options.queryParams) {
        url = url + '?' + toQueryString(options.queryParams);
      }

      return fetch(url, init).then(function (response) {
        // Okay: passthrough
        if (response.status >= 200 && response.status < 300) {
          return Promise.resolve(response);
        } else if (response.headers.get('Content-Type') === JSONTYPE) {
          return response.json().then(function (json) {
            // Only want to try refreshing token when there's an invalid session
            if ('errorCode' in json && json['errorCode'] === ErrInvalidSession) {
              if (!options.refreshOnFailure) {
                _this6.authManager.clear();
                var _error = new BaasError(json['error'], json['errorCode']);
                _error.response = response;
                throw _error;
              }

              return _this6._refreshToken().then(function () {
                options.refreshOnFailure = false;
                return _this6._doAuthed(resource, method, options);
              });
            }

            var error = new BaasError(json['error'], json['errorCode']);
            error.response = response;
            throw error;
          });
        }

        var error = new Error(response.statusText);
        error.response = response;
        throw error;
      });
    }
  }, {
    key: '_refreshToken',
    value: function _refreshToken() {
      var _this7 = this;

      if (this.authManager.isImpersonatingUser()) {
        return this.authManager.refreshImpersonation(this);
      }
      return this._doAuthed('/auth/newAccessToken', 'POST', { refreshOnFailure: false, useRefreshToken: true }).then(function (response) {
        return response.json().then(function (json) {
          _this7.authManager.setAccessToken(json['accessToken']);
          return Promise.resolve();
        });
      });
    }
  }, {
    key: 'executePipeline',
    value: function executePipeline(stages, options) {
      var responseDecoder = JSON.parse;
      var responseEncoder = JSON.stringify;
      if (options) {
        if (options.decoder) {
          if (typeof options.decoder !== 'function') {
            throw new Error('decoder option must be a function, but "' + _typeof(options.decoder) + '" was provided');
          }
          responseDecoder = options.decoder;
        }
        if (options.encoder) {
          if (typeof options.encoder !== 'function') {
            throw new Error('encoder option must be a function, but "' + _typeof(options.encoder) + '" was provided');
          }
          responseEncoder = options.encoder;
        }
      }
      return this._doAuthed('/pipeline', 'POST', { body: responseEncoder(stages) }).then(function (response) {
        if (response.arrayBuffer) {
          return response.arrayBuffer();
        }
        return response.buffer();
      }).then(function (buf) {
        return new TextDecoder('utf-8').decode(buf);
      }).then(function (body) {
        return responseDecoder(body);
      });
    }
  }]);

  return BaasClient;
}();

var DB = function () {
  function DB(client, service, name) {
    _classCallCheck(this, DB);

    this.client = client;
    this.service = service;
    this.name = name;
  }

  _createClass(DB, [{
    key: 'getCollection',
    value: function getCollection(name) {
      return new Collection(this, name);
    }
  }]);

  return DB;
}();

var Collection = function () {
  function Collection(db, name) {
    _classCallCheck(this, Collection);

    this.db = db;
    this.name = name;
  }

  _createClass(Collection, [{
    key: 'getBaseArgs',
    value: function getBaseArgs() {
      return {
        'database': this.db.name,
        'collection': this.name
      };
    }
  }, {
    key: 'deleteOne',
    value: function deleteOne(query) {
      var args = this.getBaseArgs();
      args.query = query;
      args.singleDoc = true;
      return this.db.client.executePipeline([{
        'service': this.db.service,
        'action': 'delete',
        'args': args
      }]);
    }
  }, {
    key: 'deleteMany',
    value: function deleteMany(query) {
      var args = this.getBaseArgs();
      args.query = query;
      args.singleDoc = false;
      return this.db.client.executePipeline([{
        'service': this.db.service,
        'action': 'delete',
        'args': args
      }]);
    }
  }, {
    key: 'find',
    value: function find(query, project) {
      var args = this.getBaseArgs();
      args.query = query;
      args.project = project;
      return this.db.client.executePipeline([{
        'service': this.db.service,
        'action': 'find',
        'args': args
      }]);
    }
  }, {
    key: 'insert',
    value: function insert(docs) {
      var toInsert = void 0;
      if (docs instanceof Array) {
        toInsert = docs;
      } else {
        toInsert = Array.from(arguments);
      }

      return this.db.client.executePipeline([{ 'action': 'literal',
        'args': {
          'items': toInsert
        }
      }, {
        'service': this.db.service,
        'action': 'insert',
        'args': this.getBaseArgs()
      }]);
    }
  }, {
    key: 'makeUpdateStage',
    value: function makeUpdateStage(query, update, upsert, multi) {
      var args = this.getBaseArgs();
      args.query = query;
      args.update = update;
      if (upsert) {
        args.upsert = true;
      }
      if (multi) {
        args.multi = true;
      }

      return {
        'service': this.db.service,
        'action': 'update',
        'args': args
      };
    }
  }, {
    key: 'updateOne',
    value: function updateOne(query, update) {
      return this.db.client.executePipeline([this.makeUpdateStage(query, update, false, false)]);
    }
  }, {
    key: 'updateMany',
    value: function updateMany(query, update, upsert, multi) {
      return this.db.client.executePipeline([this.makeUpdateStage(query, update, false, true)]);
    }
  }, {
    key: 'upsert',
    value: function upsert(query, update) {
      return this.db.client.executePipeline([this.makeUpdateStage(query, update, true, false)]);
    }
  }]);

  return Collection;
}();

var MongoClient = exports.MongoClient = function () {
  function MongoClient(baasClient, serviceName) {
    _classCallCheck(this, MongoClient);

    this.baasClient = baasClient;
    this.service = serviceName;
  }

  _createClass(MongoClient, [{
    key: 'getDb',
    value: function getDb(name) {
      return new DB(this.baasClient, this.service, name);
    }
  }]);

  return MongoClient;
}();

var Admin = exports.Admin = function () {
  function Admin(baseUrl) {
    _classCallCheck(this, Admin);

    this.client = new BaasClient('', { baseUrl: baseUrl });
  }

  _createClass(Admin, [{
    key: '_doAuthed',
    value: function _doAuthed(url, method, options) {
      return this.client._doAuthed(url, method, options).then(function (response) {
        return response.json();
      });
    }
  }, {
    key: '_get',
    value: function _get(url, queryParams) {
      return this._doAuthed(url, 'GET', { queryParams: queryParams });
    }
  }, {
    key: '_put',
    value: function _put(url, queryParams) {
      return this._doAuthed(url, 'PUT', { queryParams: queryParams });
    }
  }, {
    key: '_delete',
    value: function _delete(url) {
      return this._doAuthed(url, 'DELETE');
    }
  }, {
    key: '_post',
    value: function _post(url, body) {
      return this._doAuthed(url, 'POST', { body: JSON.stringify(body) });
    }
  }, {
    key: 'profile',
    value: function profile() {
      var _this8 = this;

      var root = this;
      return {
        keys: function keys() {
          return {
            list: function list() {
              return root._get('/profile/keys');
            },
            create: function create(key) {
              return root._post('/profile/keys');
            },
            apiKey: function apiKey(keyId) {
              return {
                get: function get() {
                  return root._get('/profile/keys/' + keyId);
                },
                remove: function remove() {
                  return _this8._delete('/profile/keys/' + keyId);
                },
                enable: function enable() {
                  return root._put('/profile/keys/' + keyId + '/enable');
                },
                disable: function disable() {
                  return root._put('/profile/keys/' + keyId + '/disable');
                }
              };
            }
          };
        }
      };
    }

    /* Examples of how to access admin API with this client:
     *
     * List all apps
     *    a.apps().list()
     *
     * Fetch app under name 'planner'
     *    a.apps().app('planner').get()
     *
     * List services under the app 'planner'
     *    a.apps().app('planner').services().list()
     *
     * Delete a rule by ID
     *    a.apps().app('planner').services().service('mdb1').rules().rule('580e6d055b199c221fcb821d').remove()
     *
     */

  }, {
    key: 'apps',
    value: function apps() {
      var _this9 = this;

      var root = this;
      return {
        list: function list() {
          return root._get('/apps');
        },
        create: function create(data) {
          return root._post('/apps', data);
        },
        app: function app(appID) {
          return {
            get: function get() {
              return root._get('/apps/' + appID);
            },
            remove: function remove() {
              return root._delete('/apps/' + appID);
            },

            users: function users() {
              return {
                list: function list(filter) {
                  return _this9._get('/apps/' + appID + '/users', filter);
                },
                user: function user(uid) {
                  return {
                    get: function get() {
                      return _this9._get('/apps/' + appID + '/users/' + uid);
                    },
                    logout: function logout() {
                      return _this9._put('/apps/' + appID + '/users/' + uid + '/logout');
                    }
                  };
                }
              };
            },

            sandbox: function sandbox() {
              return {
                executePipeline: function executePipeline(data, userId) {
                  return _this9._doAuthed('/apps/' + appID + '/sandbox/pipeline', 'POST', { body: JSON.stringify(data), queryParams: { user_id: userId } });
                }
              };
            },

            authProviders: function authProviders() {
              return {
                create: function create(data) {
                  return _this9._post('/apps/' + appID + '/authProviders', data);
                },
                list: function list() {
                  return _this9._get('/apps/' + appID + '/authProviders');
                },
                provider: function provider(authType, authName) {
                  return {
                    get: function get() {
                      return _this9._get('/apps/' + appID + '/authProviders/' + authType + '/' + authName);
                    },
                    remove: function remove() {
                      return _this9._delete('/apps/' + appID + '/authProviders/' + authType + '/' + authName);
                    },
                    update: function update(data) {
                      return _this9._post('/apps/' + appID + '/authProviders/' + authType + '/' + authName, data);
                    }
                  };
                }
              };
            },
            variables: function variables() {
              return {
                list: function list() {
                  return _this9._get('/apps/' + appID + '/vars');
                },
                variable: function variable(varName) {
                  return {
                    get: function get() {
                      return _this9._get('/apps/' + appID + '/vars/' + varName);
                    },
                    remove: function remove() {
                      return _this9._delete('/apps/' + appID + '/vars/' + varName);
                    },
                    create: function create(data) {
                      return _this9._post('/apps/' + appID + '/vars/' + varName, data);
                    },
                    update: function update(data) {
                      return _this9._post('/apps/' + appID + '/vars/' + varName, data);
                    }
                  };
                }
              };
            },
            logs: function logs() {
              return {
                get: function get(filter) {
                  return _this9._get('/apps/' + appID + '/logs', filter);
                }
              };
            },
            apiKeys: function apiKeys() {
              return {
                list: function list() {
                  return _this9._get('/apps/' + appID + '/keys');
                },
                create: function create(data) {
                  return _this9._post('/apps/' + appID + '/keys', data);
                },
                apiKey: function apiKey(key) {
                  return {
                    get: function get() {
                      return _this9._get('/apps/' + appID + '/keys/' + key);
                    },
                    remove: function remove() {
                      return _this9._delete('/apps/' + appID + '/keys/' + key);
                    },
                    enable: function enable() {
                      return _this9._put('/apps/' + appID + '/keys/' + key + '/enable');
                    },
                    disable: function disable() {
                      return _this9._put('/apps/' + appID + '/keys/' + key + '/disable');
                    }
                  };
                }
              };
            },
            services: function services() {
              return {
                list: function list() {
                  return _this9._get('/apps/' + appID + '/services');
                },
                create: function create(data) {
                  return _this9._post('/apps/' + appID + '/services', data);
                },
                service: function service(svc) {
                  return {
                    get: function get() {
                      return _this9._get('/apps/' + appID + '/services/' + svc);
                    },
                    update: function update(data) {
                      return _this9._post('/apps/' + appID + '/services/' + svc, data);
                    },
                    remove: function remove() {
                      return _this9._delete('/apps/' + appID + '/services/' + svc);
                    },
                    setConfig: function setConfig(data) {
                      return _this9._post('/apps/' + appID + '/services/' + svc + '/config', data);
                    },

                    rules: function rules() {
                      return {
                        list: function list() {
                          return _this9._get('/apps/' + appID + '/services/' + svc + '/rules');
                        },
                        create: function create(data) {
                          return _this9._post('/apps/' + appID + '/services/' + svc + '/rules');
                        },
                        rule: function rule(ruleId) {
                          return {
                            get: function get() {
                              return _this9._get('/apps/' + appID + '/services/' + svc + '/rules/' + ruleId);
                            },
                            update: function update(data) {
                              return _this9._post('/apps/' + appID + '/services/' + svc + '/rules/' + ruleId, data);
                            },
                            remove: function remove() {
                              return _this9._delete('/apps/' + appID + '/services/' + svc + '/rules/' + ruleId);
                            }
                          };
                        }
                      };
                    },

                    triggers: function triggers() {
                      return {
                        list: function list() {
                          return _this9._get('/apps/' + appID + '/services/' + svc + '/triggers');
                        },
                        create: function create(data) {
                          return _this9._post('/apps/' + appID + '/services/' + svc + '/triggers');
                        },
                        trigger: function trigger(triggerId) {
                          return {
                            get: function get() {
                              return _this9._get('/apps/' + appID + '/services/' + svc + '/triggers/' + triggerId);
                            },
                            update: function update(data) {
                              return _this9._post('/apps/' + appID + '/services/' + svc + '/triggers/' + triggerId, data);
                            },
                            remove: function remove() {
                              return _this9._delete('/apps/' + appID + '/services/' + svc + '/triggers/' + triggerId);
                            }
                          };
                        }
                      };
                    }
                  };
                }
              };
            }
          };
        }
      };
    }
  }, {
    key: '_admin',
    value: function _admin() {
      var _this10 = this;

      return {
        logs: function logs() {
          return {
            get: function get(filter) {
              return _this10._doAuthed('/admin/logs', 'GET', { useRefreshToken: true, queryParams: filter });
            }
          };
        },
        users: function users() {
          return {
            list: function list(filter) {
              return _this10._doAuthed('/admin/users', 'GET', { useRefreshToken: true, queryParams: filter });
            },
            user: function user(uid) {
              return {
                logout: function logout() {
                  return _this10._doAuthed('/admin/users/' + uid + '/logout', 'PUT', { useRefreshToken: true });
                }
              };
            }
          };
        }
      };
    }
  }, {
    key: '_isImpersonatingUser',
    value: function _isImpersonatingUser() {
      return this.client.authManager.isImpersonatingUser();
    }
  }, {
    key: '_startImpersonation',
    value: function _startImpersonation(userId) {
      return this.client.authManager.startImpersonation(this.client, userId);
    }
  }, {
    key: '_stopImpersonation',
    value: function _stopImpersonation(userId) {
      return this.client.authManager.stopImpersonation();
    }
  }]);

  return Admin;
}();