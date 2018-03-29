# ************************************************************
# Sequel Pro SQL dump
# Version 4541
#
# http://www.sequelpro.com/
# https://github.com/sequelpro/sequelpro
#
# Host: 127.0.0.1 (MySQL 5.7.18)
# Database: web_counter
# Generation Time: 2018-03-14 10:27:22 +0000
# ************************************************************


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


# Dump of table website_stats
# ------------------------------------------------------------

DROP TABLE IF EXISTS `website_stats`;

CREATE TABLE `website_stats` (
  `web_id` int(11) unsigned NOT NULL,
  `all_hits` int(11) DEFAULT NULL,
  `all_visits` int(11) DEFAULT NULL,
  PRIMARY KEY (`web_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;



# Dump of table counter
# ------------------------------------------------------------

DROP TABLE IF EXISTS `website_histories`;

CREATE TABLE `counter` (
  `web_id` int(11) NOT NULL,
  `all_hits` int(11) DEFAULT NULL,
  `today_hits` int(11) DEFAULT NULL,
  `all_visits` int(11) DEFAULT NULL,
  `today_visits` int(11) DEFAULT NULL,
  `created_at` date NOT NULL,
  PRIMARY KEY (`web_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;




/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
