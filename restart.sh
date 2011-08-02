#!/bin/bash


cd ~/fc/bruml
kill -9 `cat /tmp/bruml.pid`

cd ~/fc/etherpad-lite/node
kill -9 `cat /tmp/epl.pid`

cd ~/fc
kill -9 `cat /tmp/shell.pid`



cd ~/fc/bruml
node server.js &> log.txt &
echo "$!" > /tmp/bruml.pid

cd ~/fc/etherpad-lite/node
node server.js &> log.txt &
echo "$!" > /tmp/epl.pid

cd ~/fc
node app.js &> log.txt &
echo "$!" > /tmp/shell.pid

