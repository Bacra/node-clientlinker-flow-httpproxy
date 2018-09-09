'use strict';

var expect				= require('expect.js');
var utilsTestHttpproxy	= require('./utils_test');
var confighandlerTest	= require('clientlinker-flow-confighandler-test');

var initLinker			= utilsTestHttpproxy.initLinker;
var initTestSvrLinker	= utilsTestHttpproxy.initTestSvrLinker;

describe('#base', function()
{
	initTestSvrLinker({});

	// describe('#run client', function()
	// {
	// 	confighandlerTest.run(svrLinker);
	// });

	describe('#run new client', function()
	{
		confighandlerTest.run(initLinker({}));
	});

	it('#no client', function()
	{
		var linker = initLinker({});
		linker.client('client_not_exists', {});

		return linker.run('client_not_exists.method')
			.then(function(){expect().fail()},
				function(err)
				{
					// 注意：不是NO CLIENT
					expect(err.message)
						.to.contain('CLIENTLINKER:NotFound,client_not_exists.method');
					expect(err.CLIENTLINKER_TYPE)
						.to.be('CLIENT FLOW OUT');
					expect(err.CLIENTLINKER_ACTION)
						.to.be('client_not_exists.method');
				});
	});
});
