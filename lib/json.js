'use strict';

var KEY        = Date.now() + process.pid + Math.floor(Math.random()*10000);
var BUFFER_KEY = KEY+'_buf';
var ERROR_KEY  = KEY+'_err';


function stringify(data)
{
	if (!data || typeof data != 'object') return data;

	return originalMap(data, function(item)
	{
		if (Buffer.isBuffer(item))
		{
			var bufValues = item.toJSON();
			// 兼容node版本
			bufValues.data && (bufValues = bufValues.data);

			return {type: BUFFER_KEY, data: bufValues};
		}
		else if (item instanceof Error)
		{
			return {
				type: ERROR_KEY,
				data: originalMap(item, exports.stringify, { message: item.message }),
			};
		}
		else if (typeof item == 'object')
			return exports.stringify(item);
		else
			return item;
	});
}


function parse(data, KEY)
{
	if (!data || typeof data != 'object' || !KEY) return data;

	var BUFFER_KEY = KEY + '_buf';
	var ERROR_KEY  = KEY + '_err';

	return originalMap(data, function(item)
	{
		if (item && typeof item == 'object')
		{
			if (item.type)
			{
				if (item.type == BUFFER_KEY)
					return new Buffer(item.data || '');
				else if (item.type == ERROR_KEY)
					return originalMap(item.data, exports.parse, new Error(item.data.message));
			}

			return exports.parse(item, KEY);
		}
		else
		{
			return item;
		}
	});
}


function originalMap(list, handler, tmpData)
{
	if (Array.isArray(list))
	{
		return list.map(handler);
	}
	else
	{
		if (!tmpData) tmpData = {};

		for(var i in list)
		{
			if (list.hasOwnProperty(i))
			{
				tmpData[i] = handler(list[i], i);
			}
		}

		return tmpData;
	}
}


exports.parse = parse;
exports.stringify = stringify;

exports.CONST_KEY = KEY;
exports.CONST_VARS =
{
	BUFFER_KEY: BUFFER_KEY,
	ERROR_KEY: ERROR_KEY
};
