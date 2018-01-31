# Mini Web Counter

Everything should be measurable !

## Installation

```bash
$ yarn
$ node main.js
```

## How to use

```js
$.getJSON("http://[your-web-counter]/hit/[webid-number]", function( data ) {
	console.log(data);
	// Use data to render to UI
});
```

