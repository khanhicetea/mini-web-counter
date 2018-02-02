const polka = require('polka');
const util = require('util');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const redis = require('redis');
const redisOptions = {
	host: process.env.REDIS_HOST || '127.0.0.1',
	port: process.env.REDIS_PORT || '6379',
};
const redisClient = redis.createClient(redisOptions);
const secretKey = process.env.HMAC_SECRET || '';
const ONLINE_WINDOW = process.env.ONLINE_WINDOW || 5000;
const HTTP_PORT = process.env.HTTP_PORT || 3000;

polka()
.use(cookieParser())
.get('/health', (req, res) => {
	res.end('Hello world');
})
.get('/hit/:webid/:sign', (req, res) => {
	const webid = req.params.webid || 0;
	const sign = req.params.sign || '';
    const hmac = crypto.createHmac('md5', secretKey);

    if (sign != hmac.update(webid.toString()).digest('hex')) {
        res.statusCode = 400;
        return res.end('');
    }

	const sid = req.cookies.sid || null;
	const now = new Date();
	const date = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDay();
	const keys = [
		util.format('web%d:all:hit', webid),
		util.format('web%d:%s:hit', webid, date),
		util.format('web%d:%d:online', webid, parseInt(now.getTime() / ONLINE_WINDOW)),
	];
	const multi = redisClient.multi();

	keys.forEach(function(key) {
		multi.incr(key);
	});

	if (sid) {
		multi.get(util.format('web%d:all:visit', webid));
		multi.get(util.format('web%d:%s:visit', webid, date));
	} else {
		multi.incr(util.format('web%d:all:visit', webid));
		multi.incr(util.format('web%d:%s:visit', webid, date));
		res.setHeader('Set-Cookie', ['sid=' + now.getTime()]);
	}

	multi.exec(function(err, replies) {
		const data = {
			all_hits: parseInt(replies[0] || 0),
			today_hits: parseInt(replies[1] || 0),
			online: parseInt(replies[2] || 0),
			all_visits: parseInt(replies[3] || 0),
			today_visits: parseInt(replies[4] || 0),
		};
		res.setHeader('Content-Type', 'application/json');
		res.end(JSON.stringify(data));
	});
})
.listen(HTTP_PORT)
.then(() => {
	console.log("> Running on port 3000 !");
})
