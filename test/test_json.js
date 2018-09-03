'use strict';

var expect	= require('expect.js');
var json	= require('../lib/json');

describe('#json', function()
{
	it('#stringify', function()
	{
		var data = {
			result: new Error('err message'),
			data: {
				string: "string",
				number: 123,
				buffer: new Buffer('buffer')
			}
		};

		var newData = json.stringify(data);
		expect(newData.result).not.to.be.a(Error);
		expect(newData.result.type).to.be( json.CONST_VARS.ERROR_KEY);
		expect(newData.result.data).to.be('err message');

		expect(newData.data.buffer).to.not.be.a(Buffer);
		expect(newData.data.buffer.type).to.be(json.CONST_VARS.BUFFER_KEY);
		expect(newData.data.buffer.data).to.be.an(Array);

		expect(newData.data.string).to.be('string');
		expect(newData.data.number).to.be(123);
	});

	it('#parse', function()
	{
		var data = {
			"result": {
				"type": "err_1454824224156",
				"data":  "err message"
			},
			"data": {
				"string": "string",
				"number": 123,
				"buffer": {
					"type": "buf_1454824224156",
					"data": [98, 117, 102, 102, 101, 114]
				},
				"buffer2": {
					"type": "buf_2222222222222",
					"data": [98, 117, 102, 102, 101, 114]
				}
			}
		};
		var TYPES = {
			BUFFER_KEY: 'buf_1454824224156',
			ERROR_KEY: 'err_1454824224156'
		};

		var newData = json.parse(data, TYPES);
		expect(newData.data).to.be.an('object');
		expect(newData.result).to.be.an(Error);
		expect(newData.result.message).to.be('err message');

		expect(newData.data.buffer).to.be.a(Buffer);
		expect(newData.data.buffer.toString()).to.be('buffer');
		expect(newData.data.buffer.toString('base64')).to.be('YnVmZmVy');
		expect(newData.data.buffer2).to.not.be.a(Buffer);

		expect(newData.data.string).to.be('string');
		expect(newData.data.number).to.be(123);
	});


	it('#array like', function()
	{
		var data = {length: 5};
		expect(json.stringify(data)).to.be.eql(data);
		expect(json.parse(data, {})).to.be.eql(data);
	});
});
