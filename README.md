Clientlinker-flow-httpproxy
============================

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][npm-url]
[![Build Status][travis-image]][travis-url]
[![Coveralls][coveralls-image]][coveralls-url]
[![NPM License][license-image]][npm-url]


# Install

Install `clientlinker` pkg

```shell
npm i clientlinker --save
```

Install flow pkg

```shell
npm i clientlinker-flow-httpproxy --save
```


# Useage

```javascript
var clientlinker = require('clientlinker');
var linker = clientlinker({
  flows: ['confighandler', 'httpproxy'],
  defaults: {
    httpproxy: 'http://localhost/clientlinker_proxy'
  },
  clients: {
    client: {
      confighandler: {
        clientHanlder: function(query, body, callback, options) {
          return Promise.resolve({result: {}});
        }
      }
    }
  }
});

linker.flow('confighandler', require('clientlinker-flow-confighandler'));
linker.flow('httpproxy', require('clientlinker-flow-httpproxy'));

// use
linker.run('client.clientHanlder', null, {id: 13})
  .then(function(){});
```



[npm-image]: http://img.shields.io/npm/v/clientlinker-flow-httpproxy.svg
[downloads-image]: http://img.shields.io/npm/dm/clientlinker-flow-httpproxy.svg
[npm-url]: https://www.npmjs.org/package/clientlinker-flow-httpproxy
[travis-image]: http://img.shields.io/travis/Bacra/node-clientlinker-flow-httpproxy/master.svg?label=linux
[travis-url]: https://travis-ci.org/Bacra/node-clientlinker-flow-httpproxy
[coveralls-image]: https://img.shields.io/coveralls/Bacra/node-clientlinker-flow-httpproxy.svg
[coveralls-url]: https://coveralls.io/github/Bacra/node-clientlinker-flow-httpproxy
[license-image]: http://img.shields.io/npm/l/clientlinker-flow-httpproxy.svg
