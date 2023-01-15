SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "-08:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

CREATE DATABASE IF NOT EXISTS `housepanel` DEFAULT CHARACTER SET utf8 COLLATE utf8_bin;
USE `housepanel`;

CREATE TABLE `configs` (
  `id` int(11) NOT NULL,
  `userid` int(11) NOT NULL,
  `configkey` varchar(80) COLLATE utf8_bin NOT NULL,
  `configval` varchar(10000) COLLATE utf8_bin NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin COMMENT='configuration options and rules';

CREATE TABLE `devices` (
  `id` int(11) NOT NULL,
  `userid` int(11) NOT NULL,
  `hubid` int(11) NOT NULL,
  `deviceid` varchar(120) COLLATE utf8_bin NOT NULL,
  `name` varchar(120) COLLATE utf8_bin DEFAULT '',
  `devicetype` varchar(40) COLLATE utf8_bin DEFAULT '',
  `hint` varchar(1000) COLLATE utf8_bin DEFAULT '',
  `refresh` varchar(20) COLLATE utf8_bin DEFAULT 'normal',
  `pvalue` varchar(20000) COLLATE utf8_bin DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin COMMENT='List of known user devices';

CREATE TABLE `hubs` (
  `id` int(11) NOT NULL,
  `userid` int(11) NOT NULL,
  `hubid` varchar(1000) COLLATE utf8_bin NOT NULL,
  `hubhost` varchar(120) COLLATE utf8_bin NOT NULL,
  `hubtype` varchar(80) COLLATE utf8_bin NOT NULL,
  `hubname` varchar(240) COLLATE utf8_bin NOT NULL,
  `clientid` varchar(240) COLLATE utf8_bin NOT NULL,
  `clientsecret` varchar(240) COLLATE utf8_bin NOT NULL,
  `hubaccess` varchar(1500) COLLATE utf8_bin NOT NULL,
  `hubendpt` varchar(1500) COLLATE utf8_bin NOT NULL,
  `hubrefresh` varchar(1500) COLLATE utf8_bin DEFAULT '',
  `useraccess` varchar(1500) COLLATE utf8_bin DEFAULT '',
  `userendpt` varchar(1500) COLLATE utf8_bin DEFAULT '',
  `hubtimer` varchar(40) COLLATE utf8_bin DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

CREATE TABLE `panels` (
  `id` int(11) NOT NULL,
  `userid` int(11) NOT NULL,
  `pname` varchar(120) COLLATE utf8_bin NOT NULL,
  `password` varchar(120) COLLATE utf8_bin NOT NULL,
  `skin` varchar(120) COLLATE utf8_bin NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin COMMENT='User specific login list of panels';

CREATE TABLE `rooms` (
  `id` int(11) NOT NULL,
  `userid` int(11) NOT NULL,
  `panelid` int(11) NOT NULL,
  `rname` varchar(120) COLLATE utf8_bin NOT NULL,
  `rorder` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin COMMENT='List of rooms by user';

CREATE TABLE `things` (
  `id` int(11) NOT NULL,
  `userid` int(11) NOT NULL,
  `roomid` int(11) NOT NULL,
  `tileid` int(11) NOT NULL,
  `posy` int(11) DEFAULT '0',
  `posx` int(11) DEFAULT '0',
  `zindex` int(11) DEFAULT '1',
  `torder` int(11) DEFAULT '1',
  `customname` varchar(120) COLLATE utf8_bin DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `email` varchar(120) COLLATE utf8_bin NOT NULL,
  `uname` varchar(40) COLLATE utf8_bin NOT NULL,
  `mobile` varchar(40) COLLATE utf8_bin DEFAULT NULL,
  `password` varchar(160) COLLATE utf8_bin NOT NULL,
  `usertype` int(11) NOT NULL,
  `defhub` varchar(1000) COLLATE utf8_bin NOT NULL,
  `hpcode` varchar(80) COLLATE utf8_bin DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin COMMENT='Primary user table';


ALTER TABLE `configs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `configs_id_link` (`userid`);

ALTER TABLE `devices`
  ADD PRIMARY KEY (`id`),
  ADD KEY `devices_id_link` (`userid`),
  ADD KEY `devices_hubid_link_idx` (`hubid`);

ALTER TABLE `hubs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `hubs_id_link` (`userid`) USING BTREE;

ALTER TABLE `panels`
  ADD PRIMARY KEY (`id`),
  ADD KEY `panels_id_link` (`userid`);

ALTER TABLE `rooms`
  ADD PRIMARY KEY (`id`),
  ADD KEY `rooms_id_link` (`userid`),
  ADD KEY `rooms_panels_link` (`panelid`);

ALTER TABLE `things`
  ADD PRIMARY KEY (`id`),
  ADD KEY `things_id_link` (`userid`),
  ADD KEY `things_rooms_link_idx` (`roomid`);

ALTER TABLE `users`
  ADD PRIMARY KEY (`id`);


ALTER TABLE `configs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `devices`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `hubs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `panels`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `rooms`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `things`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;


ALTER TABLE `configs`
  ADD CONSTRAINT `configs_id_link` FOREIGN KEY (`userid`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `devices`
  ADD CONSTRAINT `devices_hubid_link` FOREIGN KEY (`hubid`) REFERENCES `hubs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `devices_id_link` FOREIGN KEY (`userid`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `hubs`
  ADD CONSTRAINT `hubs_id_link` FOREIGN KEY (`userid`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `panels`
  ADD CONSTRAINT `panels_id_link` FOREIGN KEY (`userid`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `rooms`
  ADD CONSTRAINT `rooms_id_link` FOREIGN KEY (`userid`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `rooms_panels_link` FOREIGN KEY (`panelid`) REFERENCES `panels` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `things`
  ADD CONSTRAINT `things_rooms_link` FOREIGN KEY (`roomid`) REFERENCES `rooms` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `things_users_link` FOREIGN KEY (`userid`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

CREATE USER IF NOT EXISTS 'housepanel'@'localhost' IDENTIFIED BY 'housepanel';
GRANT ALL ON housepanel.* TO 'housepanel'@'localhost'
