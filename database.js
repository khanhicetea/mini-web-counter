const mysql = require('mysql');
const moment = require('moment');
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
    const connection = makeConnection();
    connection.connect(function (err) {
        if (err) {
            console.error('error connecting: ' + err.stack);
            return;
        }

        console.log('connected as id ' + connection.threadId);
        redisClient.smembers("day_counter", function (err, replies) {
            const numWeb = replies.length;
            let counter = 0;

            replies.forEach(function (webid) {
                const multi = redisClient.multi();
                const date = moment().subtract(1, "days").format('YYYY-MM-DD');
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
                multi.srem('day_counter', webid);
                multi.exec(function (err, replies) {
                    var data_web_counter = {
                        all_hits: parseInt(replies[0] || 0),
                        today_hits: parseInt(replies[1] || 0),
                        all_visits: parseInt(replies[2] || 0),
                        today_visits: parseInt(replies[3] || 0),
                    };
                    data_web_counter.web_id = webid;
                    data_web_counter.created_at = moment().subtract(1, "days").format('YYYY-MM-DD');
                    connection.query('INSERT INTO counter SET ?', data_web_counter, function (error, results, fields) {
                        if (error) {
                            console.log(error);
                            throw error;
                        }
                        if (++counter == numWeb) {
                            connection.end(function(err) {
                                if (err) {
                                    console.log(err);
                                    throw err;
                                }
                                console.log("connection is closed !");
                            });
                        }
                    });
                });
            });
        });
    });
}

const DATABASE = {
    backupCounter: backupCounter,
    makeConnection: makeConnection,
}

module.exports = DATABASE