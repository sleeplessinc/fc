#!/bin/bash

export PATH="/usr/local/bin:$PATH"


cd ~/fc/bruml
kill -9 `cat pid`

cd ~/fc/etherpad-lite/node
kill -9 `cat pid`

cd ~/fc
kill -9 `cat pid`



cd ~/fc/bruml
node server.js &> log.txt &
echo "$!" > pid

cd ~/fc/etherpad-lite/node
node server.js &> log.txt &
echo "$!" > pid

cd ~/fc
node app.js &> log.txt &
echo "$!" > pid

