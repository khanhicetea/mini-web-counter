# Mini Web Counter

Everything should be measurable !

## Installation

```bash
$ yarn
$ node main.js
```

## Environments

- `REDIS_HOST` : redis hostname (127.0.0.1)
- `REDIS_PORT` : redis port (6379)
- `HMAC_SECRET` : hmac md5 algo secret
- `ONLINE_WINDOW` : window time period of online users
- `HTTP_PORT` : http server port

## How to use

```js
$.ajax({
	url: "http://[your-web-counter]/hit/[webid-number]/[hmac-signature]",
	dataType: "jsonp",
	jsonpCallback: "callbackResults",
}, function( data ) {
	console.log(data);
	// Use data to render to UI
});
```

## LICENSE

The MIT License (MIT)

Copyright (c) 2018 Khanh Nguyen

