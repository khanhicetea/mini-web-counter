const mysql = require('mysql');
const moment = require('moment');
const util = require('util');

function createPoolingConnections() {
    return mysql.createPool({
        connectionLimit: 10,
        host: process.env.DATABASE_HOST || '127.0.0.1',
        user: process.env.DATABASE_USERNAME || 'root',
        password: process.env.DATABASE_PASSWORD || 'passwd',
        database: process.env.DATABASE_NAME || 'web_counter'
    });
}

function backupCounterData(redisClient, mysqlConnection) {
    const today = moment().subtract(1, "days").format('YYYY-MM-DD');

    redisClient.smembers("day_counter", function (err, replies) {
        if (err) throw err;

        const numWeb = replies.length;
        let counter = 0;

        mysqlConnection.beginTransaction(function(err) {
            if (err) throw err;

            replies.forEach(function (webid) {
                const multi = redisClient.multi();
                const keys = {
                    all_hits: util.format('web%d:all:hit', webid),
                    today_hits: util.format('web%d:%s:hit', webid, today),
                    all_visits: util.format('web%d:all:visit', webid),
                    today_visits: util.format('web%d:%s:visit', webid, today),
                }
                multi.get(keys.all_hits);
                multi.get(keys.today_hits);
                multi.get(keys.all_visits);
                multi.get(keys.today_visits);
                multi.srem('day_counter', webid);
                multi.exec(function (err, replies) {
                    if (err) throw err;

                    const data_web_counter = {
                        web_id: parseInt(webid),
                        all_hits: parseInt(replies[0] || 0),
                        today_hits: parseInt(replies[1] || 0),
                        all_visits: parseInt(replies[2] || 0),
                        today_visits: parseInt(replies[3] || 0),
                        created_at: today,
                    };
                    
                    const data_backup = {
                        web_id: data_web_counter.web_id,
                        all_hits: data_web_counter.all_hits,
                        all_visits: data_web_counter.all_visits,
                    }

                    mysqlConnection.query('INSERT IGNORE INTO `website_histories` SET ?', data_web_counter, function (error, results, fields) {
                        if (error) {
                            console.log(error);
                            throw error;
                        }
                    });

                    mysqlConnection.query('INSERT INTO `website_stats` SET ? ON DUPLICATE KEY UPDATE ?', [data_backup, data_backup], function (error, results, fields) {
                        if (error) {
                            console.log(error);
                            throw error;
                        }
                    });

                    if (++counter == numWeb) {
                        mysqlConnection.commit(function(err) {
                            if (err) throw err;
                        });
                    }
                });
            });
        });
    });
}

module.exports = {
    backupCounterData: backupCounterData,
    createPoolingConnections: createPoolingConnections,
};