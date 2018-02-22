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
const ONLINE_WINDOW = process.env.ONLINE_WINDOW || 5;
const HTTP_PORT = process.env.HTTP_PORT || 3000;

polka()
.use(cookieParser())
.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', [req.headers.origin]);
    res.setHeader('Access-Control-Allow-Credentials', ['true']);
    res.setHeader('Access-Control-Allow-Headers', ['DNT,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type']);
    next();
})
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
    const multi = redisClient.multi();
    const now = new Date();
    const ts = parseInt(now / 1000);
    const date = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
    const keys = {
        all_hits: util.format('web%d:all:hit', webid),
        today_hits: util.format('web%d:%s:hit', webid, date),
        online: util.format('web%d:%d:online', webid, parseInt(ts / ONLINE_WINDOW)),
        all_visits: util.format('web%d:all:visit', webid),
        today_visits: util.format('web%d:%s:visit', webid, date),
    }

    multi.incr(keys.all_hits);
    multi.incr(keys.today_hits);

    if (sid) {
        multi.get(keys.online);
        multi.get(keys.all_visits);
        multi.get(keys.today_visits);
    } else {
        multi.incr(keys.online);
        multi.incr(keys.all_visits);
        multi.incr(keys.today_visits);
        const expire_ts = (parseInt(ts / ONLINE_WINDOW) + 1 ) * ONLINE_WINDOW * 1000;
        const expire = (new Date(expire_ts)).toGMTString();
        res.setHeader('Set-Cookie', ['sid=' + ts + '; expires=' + expire]);
    }

    multi.expire(keys.today_hits, 86400);
    multi.expire(keys.online, ts + ONLINE_WINDOW);
    multi.expire(keys.today_visits, 86400);

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
    console.log("> Running on port "+HTTP_PORT+" !");
})
