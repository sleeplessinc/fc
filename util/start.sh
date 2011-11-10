#!/bin/bash

cd ~

export PATH="/usr/local/bin:$PATH"




rm -rf fc
git clone git@github.com:sleeplessinc/fc.git
cd fc
git checkout master
git submodule init && git submodule update
npm install
cd etherpad-lite
npm install
cd ..
cp settings.json etherpad-lite

cd ../bruml
npm install socket.io
## mongorestore -d fc ./dump/fc_dev


## init fcbackup 
cd ~/fc/fcbackups
chmod 775 fcbackup_init.sh
./fcbackup_init.sh



cd
ln -sf fc/bruml/log.txt b.log
ln -sf fc/etherpad-lite/node/log.txt e.log

./restart.sh







