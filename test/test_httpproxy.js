'use strict';

var expect				= require('expect.js');
var request				= require('request');
var aes					= require('../lib/aes_cipher');
var httpproxy			= require('../flow/httpproxy');
var utilsTestHttpproxy	= require('./utils_test');
var confighandlerTest	= require('clientlinker-flow-confighandler-test');

var initLinker			= utilsTestHttpproxy.initLinker;
var initTestSvrLinker	= utilsTestHttpproxy.initTestSvrLinker;


describe('#httpproxy', function()
{
	describe('#err statusCode', function()
	{
		describe('#5xx', function()
		{
			initTestSvrLinker();
			var linker = initLinker(
				{
					flows: ['custom'],
					customFlows:
					{
						custom: function custom(runtime, callback)
						{
							var body = httpproxy.getRequestBody_(runtime);
							httpproxy.getRequestParams_(runtime, body)
								.then(function(opts)
								{
									request.post(opts, function(err, response, body)
									{
										callback.resolve(
											{
												err: err,
												response: response,
												body: body
											});
									});
								});
						}
					}
				});

			var linker2 = initLinker();

			describe('#501', function()
			{
				function itKey(name, action)
				{
					it('#request:'+name, function()
					{
						return linker.run(action)
							.then(function(data)
							{
								expect(data.err).to.be(null);
								expect(data.response.statusCode).to.be(501);
							});
					});

					it('#run:'+name, function()
					{
						var retPromise = linker2.run(action);
						var runtime = linker2.lastRuntime;

						return retPromise
							.then(function(){expect().fail()},
								function(err)
								{
									var responeError = runtime.debug('httpproxyResponeError');
									expect(responeError.message)
										.to.be('httpproxy,respone!200,501');
									expect(err.message.substr(0, 22))
										.to.be('CLIENTLINKER:NotFound,');
								});
					});
				}

				itKey('method not exists', 'client_its.method_no_exists');
				itKey('no flows', 'client_svr_noflows.method');
				itKey('no client', 'client_svr_not_exists.method');
			});
		});


		describe('#5xx_parse', function()
		{
			initTestSvrLinker();
			var linker = initLinker(
				{
					flows: ['custom'],
					customFlows:
					{
						custom: function custom(runtime, callback)
						{
							var body = httpproxy.getRequestBody_(runtime);
							httpproxy.getRequestParams_(runtime, body)
								.then(function(opts) {
									opts.body = '{dd';
									request.post(opts, function(err, response, body)
									{
										callback.resolve(
											{
												err: err,
												response: response,
												body: body
											});
									});
								});
						}
					}
				});

			it('#err', function()
			{
				return linker.run('client_its.method_promise_resolve')
					.then(function(data)
					{
						expect(data.err).to.be(null);
						expect(data.response.statusCode).to.be(500);
						var body = JSON.parse(data.body);
						expect(body.httpproxy_msg).to.be.an('array')
						expect(body.httpproxy_msg.join())
							.to.contain('clientlinker run err:');
					});
			});
		});
	});


	describe('#options', function()
	{
		describe('#httpproxyKey', function()
		{
			var httpproxyKey = 'xxfde&d023';
			initTestSvrLinker(
			{
				defaults:
				{
					httpproxyKey: httpproxyKey
				}
			});

			describe('#run client', function()
			{
				confighandlerTest.run(initLinker(
				{
					defaults:
					{
						httpproxyKey: httpproxyKey
					}
				}));
			});

			describe('#err403', function()
			{
				function itKey(name, statusCode, key)
				{
					it('#'+name, function()
					{
						var linker = initLinker(
						{
							flows: ['custom'],
							customFlows:
							{
								custom: function custom(runtime, callback)
								{
									var body = httpproxy.getRequestBody_(runtime);
									body.key = key;
									httpproxy.getRequestParams_(runtime, body)
										.then(function(opts) {
											request.post(opts, function(err, response, body)
											{
												callback.resolve(
													{
														err: err,
														response: response,
														body: body
													});
											});
										});
								}
							}
						});

						return linker.run('client_its.method')
							.then(function(data)
							{
								expect(data.err).to.be(null);
								expect(data.response.statusCode).to.be(statusCode);
								expect(data.body).to.contain('route catch:');
							});
					});
				}

				itKey('normal', 200,
					aes.cipher('client_its.method,'+Date.now(), httpproxyKey));

				itKey('no key', 403);
				itKey('err key', 403, 'dddd');
				itKey('err key', 403,
					aes.cipher('client_its.method,'+Date.now(), httpproxyKey+'22'));
				itKey('err key', 403,
					aes.cipher('client_its.method_other,'+Date.now(), httpproxyKey));
				itKey('expired', 403,
					aes.cipher('client_its.method,11', httpproxyKey));

				itKey('direct', 200, httpproxyKey);
			});

			// it('#err403', function()
			// {
			// 	var linker = initLinker(
			// 		{
			// 			defaults: {
			// 				httpproxyKey: 'xxx'
			// 			}
			// 		});
			//
			// 	return linker.run('client_its.method')
			// 		.then(function(){expect().fail()},
			// 			function(err)
			// 			{
			// 				expect(err).to.be('respone!200,403');
			// 			});
			// });
		});


		describe('#httpproxyMaxLevel', function()
		{
			function descKey(svrLevel)
			{
				function itKey(level)
				{
					it('#'+level, function()
					{
						var linker = initLinker(
							{
								defaults:
								{
									httpproxyMaxLevel: level
								}
							});
						var retPromise = linker.run('client_its.method_no_exists');
						var runtime = linker.lastRuntime;

						return retPromise
							.then(function(){expect().fail()},
								function(err)
								{
									expect(err.CLIENTLINKER_TYPE).to.be('CLIENT FLOW OUT');
									expect(runtime.env.source).to.be('run');

									if (level === 0)
									{
										expect(runtime.env.httpproxyLevel)
											.to.be(undefined);
										var responeError = runtime.retry[0]
											.getRunnedFlowByName('httpproxy')
											.httpproxyResponeError;
										expect(responeError).to.be(undefined);
									}
									else
									{
										var targetSvrLevel = svrLevel > 0 ? svrLevel : 1;
										expect(runtime.env.httpproxyLevel)
											.to.be(targetSvrLevel);
										var responeError = runtime.debug('httpproxyResponeError');
										expect(responeError.message)
											.to.be('httpproxy,respone!200,501');
										expect(err.message.substr(0, 22))
											.to.be('CLIENTLINKER:NotFound,');
									}

								});
					});
				}

				describe('#svrLevel:'+svrLevel, function()
				{
					initTestSvrLinker(
					{
						defaults:
						{
							httpproxyMaxLevel: svrLevel
						}
					});

					describe('#run new client', function()
					{
						confighandlerTest.run(initLinker({}));
					});

					describe('#run level', function()
					{
						itKey(1);
						itKey(5);
						itKey();
						itKey(0);
						itKey(-1);
					});
				});
			}

			descKey(3);
			descKey(1);
			descKey();
			descKey(0);
			descKey(-1);
		});
	});

});
