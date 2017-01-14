#!/bin/bash

GIT_DIR=$(git rev-parse --git-dir 2> /dev/null)
if [ ! -e $GIT_DIR ] ; then
	echo Source this script from directory inside the git repo.
	return 1
fi

# install in directory work in the top-level dir in the project
DIR=${GIT_DIR}/../work

if [ ! -e $DIR ]; then
	mkdir $DIR
fi

# normalize dir
OLD_PWD=$(pwd)
cd $DIR
DIR=$(pwd)
cd -

echo Installing in $DIR

# Install miniconda
MINICONDA=$DIR/miniconda.sh
if [ ! -e $MINICONDA ] ; then
    echo Downloading miniconda
    wget --quiet https://repo.continuum.io/miniconda/Miniconda3-latest-Linux-x86_64.sh -O $MINICONDA
		wgetRetVal=$?
		if [[ wgetRetVal -ne 0 ]] ; then
			rm $MINICONDA
			echo "Can't download MINICONDA.!!!"
			return 1
		fi
    chmod u+x $MINICONDA
fi

INSTALL_DIR=$DIR/miniconda
if [ ! -e $INSTALL_DIR ]; then
  echo Installing miniconda
  $MINICONDA -b -p $INSTALL_DIR
fi
export PATH=${PATH}:${INSTALL_DIR}/bin

# Install node.js
NODE_VERSION=4.4.4
NODE_TAR=$DIR/node.tar.xz
URL=https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz
if [ ! -e $NODE_TAR ]; then
	echo Downloading node
	wget --quiet $URL -O $NODE_TAR
	wgetRetVal=$?
	if [[ wgetRetVal -ne 0 ]] ; then
		rm $NODE_TAR
		echo "Can't download NODE.!!!"
		return 1
	fi
fi
tar xf $NODE_TAR -C $DIR
export PATH=$DIR/node-v${NODE_VERSION}-linux-x64/bin:${PATH}

# Install Python dependencies
echo Creating Python environment
conda env create -f setup/environment.yml
source activate dave

# Installing node modules
echo Installing node modules
cd src/main/js/electron
npm install
cd -

# Test
echo "Using node $(node --version)"
echo "Using npm $(npm --version)"
