var mysql = require('mysql');
var moment = require('moment');
const util = require('util');

function makeConnection() {
    return mysql.createConnection({
        host: process.env.DATABASE_HOST || '127.0.0.1',
        user: process.env.DATABASE_USERNAME || 'root',
        password: process.env.DATABASE_PASSWORD || 'passwd',
        database: process.env.DATABASE_NAME || 'web_counter'
    });
}

function backupCounter(redisClient) {
    var connection = makeConnection();
    connection.connect(function (err) {
        if (err) {
            console.error('error connecting: ' + err.stack);
            return;
        }

        console.log('connected as id ' + connection.threadId);
        connection.beginTransaction(function (err) {
            if (err) { throw err; }
            redisClient.get("day_counter", function (err, reply) {
                var day_counter = JSON.parse(reply);
                Object.keys(day_counter).forEach(function (webid) {
                    const multi = redisClient.multi();
                    const now = new Date();
                    const date = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
                    const keys = {
                        all_hits: util.format('web%d:all:hit', webid),
                        today_hits: util.format('web%d:%s:hit', webid, date),
                        all_visits: util.format('web%d:all:visit', webid),
                        today_visits: util.format('web%d:%s:visit', webid, date),
                    }
                    multi.get(keys.all_hits);
                    multi.get(keys.today_hits);
                    multi.get(keys.all_visits);
                    multi.get(keys.today_visits);
                    multi.exec(function (err, replies) {
                        var data_web_counter = {
                            all_hits: parseInt(replies[0] || 0),
                            today_hits: parseInt(replies[1] || 0),
                            all_visits: parseInt(replies[2] || 0),
                            today_visits: parseInt(replies[3] || 0),
                        };
                        data_web_counter.web_id = webid;
                        data_web_counter.created_at = moment().format('YYYY-MM-DD');
                        connection.query('INSERT INTO counter SET ?', data_web_counter, function (error, results, fields) {
                            if (error) {
                                return connection.rollback(function () {
                                    throw error;
                                });
                            }
                        });
                    });
                });
                connection.commit(function (err) {
                    if (err) {
                        return connection.rollback(function () {
                            throw err;
                        });
                    }
                    redisClient.set('day_counter', JSON.stringify({}));
                    connection.end(function (err) {
                        if (err) {
                            console.error('error end connecting: ' + err.stack);
                            return;
                        }

                        console.log('connection is closed');
                    });
                });
            });
        });
    });
}

const WEB_SERVER = {
    backupCounter: backupCounter,
    makeConnection: makeConnection,
}

module.exports = WEB_SERVER