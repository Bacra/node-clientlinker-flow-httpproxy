'use strict';

var expect	= require('expect.js');
var json	= require('../lib/json');

describe('#json', function()
{
	it('#stringify', function()
	{
		var err = new Error('err message2');
		err.errCode = -1;
		var data = {
			result: new Error('err message'),
			result2: err,
			data: {
				string: "string",
				number: 123,
				buffer: new Buffer('buffer')
			}
		};

		var newData = json.stringify(data);
		expect(newData.result).not.to.be.a(Error);
		expect(newData.result.type).to.be( json.CONST_VARS.ERROR_KEY);
		expect(newData.result.data.message).to.be('err message');

		expect(newData.result2.type).to.be( json.CONST_VARS.ERROR_KEY);
		expect(newData.result2.data.message).to.be('err message2');
		expect(newData.result2.data.errCode).to.be(-1);

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
				"type": "1454824224156_err",
				"data": { message: "err message" }
			},
			"result2": {
				"type": "1454824224156_err",
				"data": { message: "err message2", errCode: -1 }
			},
			"data": {
				"string": "string",
				"number": 123,
				"buffer": {
					"type": "1454824224156_buf",
					"data": [98, 117, 102, 102, 101, 114]
				},
				"buffer2": {
					"type": "2222222222222_buf",
					"data": [98, 117, 102, 102, 101, 114]
				}
			}
		};
		var KEY = 1454824224156;

		var newData = json.parse(data, KEY);
		expect(newData.data).to.be.an('object');
		expect(newData.result).to.be.an(Error);
		expect(newData.result.message).to.be('err message');

		expect(newData.result2).to.be.an(Error);
		expect(newData.result2.message).to.be('err message2');
		expect(newData.result2.errCode).to.be(-1);

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
