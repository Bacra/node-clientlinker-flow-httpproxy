'use strict';

var _			= require('lodash');
var debug		= require('debug')('clientlinker:httpproxy');
var deprecate	= require('depd')('clientlinker:httpproxy');
var request		= require('request');
var aes			= require('../lib/aes_cipher');
var json		= require('../lib/json');

exports = module.exports = httpproxy;
exports.methods = function(){return ['*']};

var urlCache = {};

function httpproxy(runtime, callback)
{
	var body = getRequestBody(runtime);
	if (!body) return callback.next();
	var params = getRequestParams(runtime, body);

	request.post(params, function(err, respone, body)
	{
		var data;
		if (!err)
		{
			try {
				data = JSON.parse(body);
				data = json.parse(data, data.CONST_KEY);
			}
			catch(e)
			{
				err = e;
			}

			if (data && data.env)
			{
				_.extend(runtime.env, data.env, {source: runtime.env.source});
			}


			if (respone.statusCode != 200)
			{
				err = new Error('httpproxy,respone!200,'+respone.statusCode);
				if (respone.statusCode == 501)
				{
					callback.httpproxyResponeError = err;
					return callback.nextAndResolve();
				}
			}
		}

		if (err)
		{
			debug('request err:%o', err);
			// 把错误暴露给外层，可以通过`runtime.retry[0].runnedFlows[0].httpproxyResponeError`获取
			callback.httpproxyResponeError = err;
			return callback(err);
		}

		// 预留接口，在客户端显示server端日志
		if (data.httpproxy_msg
			&& Array.isArray(data.httpproxy_msg))
		{
			data.httpproxy_msg.forEach(function(msg)
			{
				debug('[route respone] %s', msg);
			});
		}

		// 预留接口，在客户端现实server端兼容日志
		if (data.httpproxy_deprecate
			&& Array.isArray(data.httpproxy_deprecate))
		{
			data.httpproxy_deprecate.forEach(function(msg)
			{
				deprecate('[route respone] '+msg);
			});
		}

		if (data.result)
			callback(data.result);
		else
			callback(null, data.data);
	});
}


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
		query		: runtime.query,
		body		: runtime.body,
		options	    : runtime.options,
		env			: runtime.env
	};

	// check aes key
	if (options.httpproxyKey)
		body.key = aes.cipher(runtime.action+','+Date.now(), options.httpproxyKey);

	return body;
}

exports.getRequestParams_ = getRequestParams;
function getRequestParams(runtime, body)
{
	var client = runtime.client;
	var options = client.options;

	var headers = options.httpproxyHeaders || {};
	headers['Content-Type'] = 'application/json';

	var runOptions	= runtime.options || {};
	var timeout		= runOptions.timeout || options.httpproxyTimeout || 10000;
	var proxy		= runOptions.httpproxyProxy
			|| options.httpproxyProxy
			|| process.env.clientlinker_http_proxy
			|| process.env.http_proxy;

	var url = appendUrl(options.httpproxy, 'action='+runtime.action);
	body = json.stringify(body);
	body.CONST_KEY = json.CONST_KEY;

	var bodystr = JSON.stringify(body, null, '\t');
	debug('request url:%s', url);

	return {
		url		: url,
		body	: bodystr,
		headers	: headers,
		timeout	: timeout,
		proxy	: proxy
	};
}
