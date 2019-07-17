'use strict';

var Promise		= require('bluebird');
var _			= require('lodash');
var debug		= require('debug')('clientlinker-flow-httpproxy');
var deprecate	= require('depd')('clientlinker-flow-httpproxy');
var request		= require('request');
var signature	= require('../lib/signature');
var json		= require('../lib/json');

exports = module.exports = httpproxy;

function httpproxy(runtime, callback)
{
	var body = getRequestBody(runtime);
	if (!body) return callback.next();

	var params = getRequestParams(runtime, body);

	return new Promise(function(resolve, reject)
		{
			request.post(params, function(err, response, body)
			{
				if (err)
					reject(err);
				else
					resolve({ response: response, body: body });
			});
		})
		.then(function(result) {
			var response = result.response;

			var clientResponseTime = +response.responseStartTime;
			var serverResponseTime = +response.headers['xh-httpproxy-responsetime'];
			debug('clientResponseTime: %s serverResponseTime: %s, remain: %sms',
				clientResponseTime, serverResponseTime, serverResponseTime - clientResponseTime);

			try {
				var data = JSON.parse(result.body);
				data = json.parse(data, data.CONST_KEY);
			}
			catch(err)
			{
				debug('request parse json err:%o', err);
				runtime.debug && runtime.debug('httpproxyResponseError', err);
				return callback.next();
			}

			if (data && data.env)
			{
				_.extend(runtime.env, data.env, {source: runtime.env.source});
			}

			// 预留接口，在客户端显示server端日志
			if (data.httpproxy_msg
				&& Array.isArray(data.httpproxy_msg))
			{
				data.httpproxy_msg.forEach(function(msg)
				{
					debug('[route response] %s', msg);
				});
			}

			// 预留接口，在客户端现实server端兼容日志
			if (data.httpproxy_deprecate
				&& Array.isArray(data.httpproxy_deprecate))
			{
				data.httpproxy_deprecate.forEach(function(msg)
				{
					deprecate('[route response] '+msg);
				});
			}

			if (response && response.statusCode != 200)
			{
				var err = new Error('httpproxy,response!200,'+response.statusCode);
				debug('request err:%o', err);
				if (response.statusCode == 501)
				{
					runtime.debug && runtime.debug('httpproxyResponseError', err);
					return callback.next();
				}

				throw err;
			}

			if (data.result)
				throw data.result;
			else
				return data.data;
		});
}

exports.getRequestBody_ = getRequestBody;
function getRequestBody(runtime)
{
	var client = runtime.client;
	var options = client.options;

	if (!options.httpproxy) return false;

	var httpproxyMaxLevel = options.httpproxyMaxLevel;
	var httpproxyNextLevel = runtime.env.httpproxyLevel || 0;
	httpproxyNextLevel++;
	if ((!httpproxyMaxLevel && httpproxyMaxLevel !== 0)
		|| httpproxyMaxLevel < 0)
	{
		httpproxyMaxLevel = 1;
	}

	if (httpproxyNextLevel > httpproxyMaxLevel)
	{
		debug('[%s] not request httpproxy, level overflow:%d >= %d',
			runtime.action, httpproxyNextLevel, httpproxyMaxLevel);
		return false;
	}

	runtime.env.httpproxyLevel = httpproxyNextLevel;


	var body = {
		query	: runtime.query,
		body	: runtime.body,
		options	: runtime.options,
		env		: runtime.env
	};

	return body;
}


var urlCache = {};
exports.appendUrl_ = appendUrl;
function appendUrl(url, query)
{
	var rootUrl = urlCache[url];

	if (!rootUrl)
	{
		var lastChar = url.charAt(url.length-1);
		var splitChar = lastChar == '?' || lastChar == '&'
				? '' : (url.indexOf('?') != -1 ? '&' : '?');
		rootUrl = urlCache[url] = url + splitChar;
	}

	return  rootUrl + query;
}

exports.getRequestParams_ = getRequestParams;
function getRequestParams(runtime, body)
{
	var client = runtime.client;
	var options = client.options;
	var runOptions	= runtime.options || {};
	var timeout		= runOptions.timeout || options.httpproxyTimeout || 10000;
	var proxy		= runOptions.httpproxyProxy
			|| options.httpproxyProxy
			|| process.env.clientlinker_http_proxy
			|| process.env.http_proxy;

	if (runOptions.httpproxyProxy === false || (!runOptions.httpproxyProxy && options.httpproxyProxy === false)) {
		proxy = false;
	}

	var headers = _.extend({}, options.httpproxyHeaders, runOptions.httpproxyHeaders);
	headers['Content-Type'] = 'application/json';

	var postBody = {
		action: runtime.action,
		data: json.stringify(body),
		CONST_KEY: json.CONST_KEY,
		// post 是没有缓存的，但还是加一个随机数，更安全一些
		random: Math.random() * 100000 | 0,
	};

	var bodystr = JSON.stringify(postBody, null, '\t')
		.replace(/\n/g, '\r\n');

	var requestStartTime = Date.now();
	// 增加对内容的签名
	// 内容可能会超级大，所以分批计算签名
	// 并且requestStartTime要尽量精确
	if (options.httpproxyKey)
	{
		var hashContent = signature.get_sha_content(bodystr);
		headers['XH-Httpproxy-DebugMd5'] = signature.md5(hashContent);

		requestStartTime = Date.now();
		var key = signature.sha_content(hashContent, requestStartTime, options.httpproxyKey);
		headers['XH-Httpproxy-Key'] = key;
	}
	headers['XH-Httpproxy-ContentTime'] = requestStartTime;

	// URL 上的action只是为了方便查看抓包请求
	// 实际以body.action为准
	var url = appendUrl(options.httpproxy, 'action='+runtime.action);

	return {
		url		: url,
		body	: bodystr,
		headers	: headers,
		timeout	: timeout,
		proxy	: proxy,
		time	: true,
	};
}
