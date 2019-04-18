const polka = require('polka');
const util = require('util');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const redis = require('redis');
const moment = require('moment-timezone');
const cronJob = require('cron').CronJob;
const database = require('./database');
const redisOptions = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || '6379',
};
const redisClient = redis.createClient(redisOptions);
const mysqlPool = database.createPoolingConnections();
const secretKey = process.env.HMAC_SECRET || '';
const ONLINE_WINDOW = process.env.ONLINE_WINDOW || 60;
const HTTP_PORT = process.env.HTTP_PORT || 3000;
const TIME_ZONE = process.env.TIME_ZONE || 'Asia/Ho_Chi_Minh';
const cron = new cronJob('01 00 00 * * *', function () {
    console.log("> Backup [ " + moment().format('YYYY-MM-DD') + " ] data from redis to database ...");
    mysqlPool.getConnection(function(err, connection) {
        if (err) throw err;
        database.backupCounterData(redisClient, connection, TIME_ZONE);
    });
}, null, true, TIME_ZONE);
const checkSignature = function(webid, sign, secret) {
    const hmac = crypto.createHmac('md5', secret);
    return sign != hmac.update(webid.toString()).digest('hex');
};

moment.tz.setDefault(TIME_ZONE);

polka()
.use(cookieParser())
.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', [req.headers.origin]);
    res.setHeader('Access-Control-Allow-Credentials', ['true']);
    res.setHeader('Access-Control-Allow-Headers', ['DNT,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type']);
    if ('OPTIONS' === req.method) {
        res.send(200);
    } else {        
        next();
    }
})
.get('/health', (req, res) => {
    res.end('Hello world');
})
.get('/hit/:webid/:sign', (req, res) => {
    const webid = req.params.webid || 0;
    const sign = req.params.sign || '';

    if (checkSignature(webid, sign, secretKey)) {
        res.statusCode = 400;
        return res.end('');
    }

    const onlineCookie = req.cookies.online || null;
    const visitCookie = req.cookies.visit || null;
    const multi = redisClient.multi();
    const now = moment();
    const ts = parseInt(now.format('X'));
    const today = now.format('YYYY-MM-DD');
    const keys = {
        all_hits: util.format('web%d:all:hit', webid),
        today_hits: util.format('web%d:%s:hit', webid, today),
        online: util.format('web%d:%d:online', webid, parseInt(ts / ONLINE_WINDOW)),
        all_visits: util.format('web%d:all:visit', webid),
        today_visits: util.format('web%d:%s:visit', webid, today),
    }

    multi.incr(keys.all_hits);
    multi.incr(keys.today_hits);

    if (onlineCookie) {
        multi.get(keys.online);
    } else {
        multi.incr(keys.online);
        const expire_ts_online = (parseInt(ts / ONLINE_WINDOW) + 1 ) * ONLINE_WINDOW * 1000;
        const expire = (new Date(expire_ts_online)).toGMTString();
        res.setHeader('Set-Cookie', ['online=' + expire_ts_online + '; expires=' + expire]);
    }

    if (visitCookie) {
        multi.get(keys.all_visits);
        multi.get(keys.today_visits);
    } else {
        multi.incr(keys.all_visits);
        multi.incr(keys.today_visits);
        res.setHeader('Set-Cookie', ['visit=' + ts]);
    }

    multi.expire(keys.today_hits, 3600 * (24 + 1));
    multi.expire(keys.online, ts + ONLINE_WINDOW * 2);
    multi.expire(keys.today_visits, 3600 * (24 + 1));
    multi.sadd('day_counter', webid.toString());
    
    multi.exec(function(err, replies) {
        if (err) {
            return res.end();
        }

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
.get('/stats/:webid/:begindate/:enddate/:sign', (req, res) => {
    const webid = req.params.webid || 0;
    const sign = req.params.sign || '';
    const begindate = req.params.begindate || '';
    const enddate = req.params.enddate || '';
    const signedValue = util.format('%d:%s:%s', webid, begindate, enddate);

    if (checkSignature(signedValue, sign, secretKey)) {
        res.statusCode = 400;
        return res.end('');
    }

    mysqlPool.getConnection(function(err, connection) {
        if (err) throw err;

        connection.query('SELECT * FROM `website_histories` WHERE (`web_id` = ?) AND (`created_at` BETWEEN ? AND ?)', [webid, begindate, enddate], function (error, results, fields) {
            connection.release();            
            if (error) throw error;

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(results));
        });
    });
})
.listen(HTTP_PORT)
.then(() => {
    mysqlPool.getConnection(function(err, connection) {
        if (err) throw err;

        connection.query('SELECT * FROM `website_stats`', function (error, results, fields) {
            connection.release();            
            if (error) throw error;

            const multi = redisClient.multi();
            results.forEach(function(web_data) {
                multi.setnx(util.format('web%d:all:hit', web_data.web_id), web_data.all_hits);
                multi.setnx(util.format('web%d:all:visit', web_data.web_id), web_data.all_visits);
            });
            multi.exec(function (err, replies) {
                if (err) throw err;

                console.log("> Restore data from database ...")
            });
        });
    });
    console.log("> Running on port "+HTTP_PORT+" !");
})
