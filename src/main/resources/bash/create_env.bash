#!/bin/bash

# Determine the directory containing this script
if [[ -n $BASH_VERSION ]]; then
		_SCRIPT_FOLDER=$(dirname "${BASH_SOURCE[0]}")
else
    echo "Only bash supported .."
    exit 1
fi


# install in directory work in the top-level dir in the project
DIR=$_SCRIPT_FOLDER/../../work

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

# Install Python dependencies
echo Creating Python environment
conda env create -f $DIR/../environment.yml
