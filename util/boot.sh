#!/bin/bash

cd /root

if test ! -e "reset.sh" ; then
cat > "reset.sh" << FIN
#!/bin/bash
curl https://s3.amazonaws.com/finalsclub/boot.sh | sh
FIN
chmod 500 reset.sh
fi


echo "Booting" `date` 

yes | yum --nogpgcheck install gcc-c++
yes | yum --nogpgcheck install openssl-devel
yes | yum --nogpgcheck install make
yes | yum --nogpgcheck install git
yes | yum --nogpgcheck install sqlite-devel

yes | yum --nogpgcheck install mysql-server
# /etc/init.d/mysqld start
# /usr/bin/mysqladmin -u root password 'foobarbazquX'


nodever="v0.4.10"
if test ! -e node-$nodever ; then
        curl http://nodejs.org/dist/node-$nodever.tar.gz > node-$nodever.tar.gz
        tar xzvf node-$nodever.tar.gz
        cd node-$nodever
        ./configure
        make
        make install
fi


if test ! -e npm ; then
        git clone http://github.com/isaacs/npm.git
        cd npm
        sudo make install
        cd ..
fi

npm install nodemon -g


curl https://s3.amazonaws.com/finalsclub/start.sh | sudo -u ec2-user sh

