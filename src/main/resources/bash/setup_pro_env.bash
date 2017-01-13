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

# Install Python dependencies
echo Creating Python environment
conda env create -f setup/environment.yml
source activate dave

# LAUNCH PYTHON SERVER
echo Launching Python Server
python ${GIT_DIR}/../src/main/python/server.py
