#!/bin/bash

function stopServer {
	#Kills Python server and exits
	echo "Sending kill to Python -> $python_pid"
	kill -s 9 $python_pid
	exit 0
}

# Determine the directory containing this script
if [[ -n $BASH_VERSION ]]; then
		_SCRIPT_FOLDER=$(dirname "${BASH_SOURCE[0]}")
else
    echo "Only bash supported."
    exit 1
fi

RES_DIR=$_SCRIPT_FOLDER/../..
OLD_PWD=$(pwd)
cd $RES_DIR
RES_DIR=$(pwd)
cd -

ENVDIR=$HOME/Dave_work

if [ ! -e $ENVDIR ]; then
	echo "Installing Python environmen"
	SETUP_CMD="$RES_DIR/resources/bash/create_env.bash"
	. $SETUP_CMD
fi

if [[ "$OSTYPE" == "darwin"* ]]; then
	# Mac OSX
	#This is for MagicFile but only applies to macosx
	if [ ! -f /usr/local/bin/brew ]; then
		if hash port 2>/dev/null; then
				echo "Installing LibMagic with MacPorts"
        sudo port install file
    else
				echo "Please install HomeBrew or MacPorts before continue."
				echo "Run this HomeBrew installation command on a terminal and relanch DAVE:"
				echo '/usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"'
				echo "Or install MacPorts with this guide:"
				echo 'https://www.macports.org/install.php'
				exit 1
    fi
	else
		echo "Installing LibMagic with HomeBrew"
		/usr/local/bin/brew install libmagic
	fi
fi

echo "Activating Python environment"
ACTIVATE_CMD="$ENVDIR/miniconda/bin/activate"
source $ACTIVATE_CMD dave

#Installing Stingray
PYTHON_FOLDER=$RES_DIR/python
echo Installing Python dependencies
cd $PYTHON_FOLDER
pip install -r requirements.txt

# LAUNCH PYTHON SERVER AND PREPARE FURTHER PROCESS KILL
echo "Launching Python Server"
python server.py $ENVDIR . & >> $ENVDIR/flaskserver.log 2>&1
python_pid=$!
trap stopServer SIGHUP SIGINT SIGTERM SIGKILL
cd -

wait $python_pid

exit $?
