#!/bin/bash
#
# Source this script to set up the environment for developing DAVE.
# - Download miniconda and install packages and virtual env
# - Download node and install packages
# - Install Python dependencies
# - Install Stingray and Astropy Helpers
# - Install Hendrics
# - Install LibMagic
# - Install node modules

# First check if the script is being sourced...
if [[ "${BASH_SOURCE[0]}" == "${0}" ]] ; then
	echo "This script has to be sourced! Like this:"
	echo "source $(basename $0)"
	exit
fi


GIT_DIR=$(git rev-parse --git-dir 2> /dev/null)
if [ ! -e $GIT_DIR ] ; then
	echo Source this script from directory inside the git repo.
	return 1
fi

# Install in directory work in the top-level dir in the project
DIR=${GIT_DIR}/../work

if [ ! -e $DIR ]; then
	mkdir $DIR
fi

# normalize dir
OLD_PWD=$(pwd)
cd $DIR
DIR=$(pwd)
cd -

# Install node.js
NODE_VERSION=14.15.4
NODE_FILENAME="node-v$NODE_VERSION"

	if [[ "$OSTYPE" == "linux"* ]]; then

		#Linux
		NODE_TAR=$DIR/$NODE_FILENAME.tar.xz
		NODE_LINUX_URL=https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz

		if [ ! -e $NODE_TAR ]; then
			echo "Downloading node for linux-x64"
			wget --quiet $NODE_LINUX_URL -O $NODE_TAR
			retVal=$?
			if [[ retVal -ne 0 ]] ; then
				rm $NODE_TAR
				echo "Can't download NODE for Linux-x64.!!!"
				return 1
			fi
		fi

		tar xf $NODE_TAR -C $DIR
		export PATH=$DIR/$NODE_FILENAME-linux-x64/bin:${PATH}

	elif [[ "$OSTYPE" == "darwin"* ]]; then

		# Mac OSX
		NODE_TAR=$DIR/$NODE_FILENAME.pkg
		NODE_MACOS_URL=https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}.pkg

		if [ ! -e $NODE_TAR ]; then
			echo "Downloading node for Mac OSX"
			curl $NODE_MACOS_URL -o $NODE_TAR
			retVal=$?
			if [[ retVal -ne 0 ]] ; then
				rm $NODE_TAR
				echo "Can't download NODE for Mac OSX!!!"
				return 1
			fi
		fi

		echo "Please type your root password for installing Node"
		sudo installer -pkg $NODE_TAR -target /

	else
		# Unknown.
		echo "Downloading node: Unsupported OS Platform"
		return 1
	fi

# Test node
NODE_VERSION_INSTALLED=$(node --version)
if [[ "$NODE_VERSION_INSTALLED" == v"$NODE_VERSION" ]]; then
  echo "Using node $NODE_VERSION"
else
  echo "Failure to install node, check the log."
  return 1
fi

echo "Using npm $(npm --version)"

echo Installing in $DIR

INSTALL_DIR=$DIR/envs
mkdir -p $INSTALL_DIR

# Install Python dependencies
if ls $INSTALL_DIR | grep -q "^dave[ ]\+"; then
  echo "dave virtual Python environment already exists"
else
  echo "Creating virtual Python environment dave"
  #echo @packages

  python3 -m venv $INSTALL_DIR/dave

  retVal=$?
  if [[ retVal -ne 0 ]] ; then
      echo "Failed to create virtual Python environment."
      return 1
  fi

fi

. $INSTALL_DIR/dave/bin/activate

packages=`cat setup/environment.txt`
pip install $packages wheel setuptools_scm numba

#Installing Stingray and Astropy Helpers
STINGRAY_FOLDER=$DIR/stingray
STINGRAY_URL=https://github.com/StingraySoftware/stingray.git
# Sets the specific commit to checkout:
# Feb 2, 2021
#STINGRAY_COMMIT_HASH=0ab2ea1a3f30d19c12a0d7f7a85fdbf6975e1bad
STINGRAY_COMMIT_HASH=main
# LINUX_COMPILATION=lib.linux-x86_64-3.5
# DARWIN_COMPILATION=lib.macosx-10.5-x86_64-3.5

if [ ! -e $STINGRAY_FOLDER ]; then

	echo Installing Stingray
	# depth 1 means only the latest commit, not the full history
	git clone --recursive --depth 1 $STINGRAY_URL $STINGRAY_FOLDER

	cd $STINGRAY_FOLDER

	# Gets specific commit version
	echo Getting specific version of Stingray
	git checkout $STINGRAY_COMMIT_HASH

	#Install stingray libraries

	retVal=$?
	if [[ retVal -ne 0 ]] ; then
	 	echo "Failed to install Stingray dependencies"
	 	return 1
	fi

	#Removes previous version of Stingray and Astropy_Helpers
	rm -rf src/main/python/stingray

	if [[ "$OSTYPE" == "linux-gnu" ]]; then
		#Linux

		#Build stingray
		pip install -e .[all]

		cd $DIR/..

		# Copy built libraries to python project
		#cp -r $STINGRAY_FOLDER/build/lib/stingray src/main/python
	elif [[ "$OSTYPE" == "darwin"* ]]; then
		# Mac OSX

		#Build stingray
		pip install -e .[all]

		cd $DIR/..

		# Copy built libraries to python project
		#cp -r $STINGRAY_FOLDER/build/lib/stingray src/main/python
	fi
fi

#Installing Hendrics
HENDRICS_FOLDER=$DIR/hendrics
HENDRICS_URL=https://github.com/StingraySoftware/HENDRICS.git
# Sets the specific commit to checkout:
# Feb 2, 2021
#HENDRICS_COMMIT_HASH=f47de1720bf1085c376b32f9140bde89c5cdcb64
HENDRICS_COMMIT_HASH=main
if [ ! -e $HENDRICS_FOLDER ]; then

	echo Installing HENDRICS
	git clone --recursive --depth 1 $HENDRICS_URL $HENDRICS_FOLDER

	cd $HENDRICS_FOLDER

	# Gets specific commit version
	echo "Getting specific version of HENDRICS: $HENDRICS_COMMIT_HASH"
	git checkout $HENDRICS_COMMIT_HASH

	# Install HENDRICS libraries

	#Removes previous version of Hendrics
	rm -rf src/main/python/hendrics

	if [[ "$OSTYPE" == "linux-gnu" ]]; then
		#Linux

		#Build HENDRICS
		pip install .[all]
		#python setup.py bdist

		cd $DIR/..

		# Copy built libraries to python project
		#cp -r $HENDRICS_FOLDER/build/lib/hendrics src/main/python

	elif [[ "$OSTYPE" == "darwin"* ]]; then
		# Mac OSX

		#Build HENDRICS
		pip install .[all]
		#python setup.py bdist

		cd $DIR/..

		# Copy built libraries to python project
		#cp -r $HENDRICS_FOLDER/build/lib/hendrics src/main/python
	fi
fi


if [[ "$OSTYPE" == "darwin"* ]]; then
    # Mac OSX
    # This is for MagicFile but only applies to macosx
    if [ ! -f /usr/local/bin/brew ]; then
        if [ -f /opt/local/bin/port ]; then
            echo "Installing LibMagic with MacPorts"
            yes | sudo /opt/local/bin/port install libmagic
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
       BREW_OUTPUT="$(/usr/local/bin/brew install libmagic 2>&1)"
			 if [[ $? -ne 0 ]] ; then
					echo "Error installing LibMagic with HomeBrew"
					echo $BREW_OUTPUT
					exit 1
			 fi
   fi
fi


# Installing node modules
echo Installing node modules
cd src/main/js/electron
npm install
NPM_INSTALL_STATUS=$?
cd -

if [ $NPM_INSTALL_STATUS -ne 0 ]; then
  echo "Failed to install node modules using npm install. Check the log."
  return 1
else
  echo "Success!"
fi
