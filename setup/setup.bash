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

echo Installing in $DIR

# Install miniconda
MINICONDA=$DIR/miniconda.sh
if [ ! -e $MINICONDA ] ; then

		if [[ "$OSTYPE" == "linux"* ]]; then
			#Linux
			echo "Downloading miniconda for Linux-x86_64"
			MINICONDA_URL_LINUX=https://repo.continuum.io/miniconda/Miniconda3-latest-Linux-x86_64.sh
			wget --quiet $MINICONDA_URL_LINUX -O $MINICONDA

		elif [[ "$OSTYPE" == "darwin"* ]]; then
      # Mac OSX
			echo "Downloading miniconda for MacOSX-x86_64"
			MINICONDA_URL_MACOS=https://repo.continuum.io/miniconda/Miniconda2-4.2.12-MacOSX-x86_64.sh
			curl -L $MINICONDA_URL_MACOS -o "$MINICONDA"

		else
      # Unknown
			echo "Error downloading miniconda: Unsupported OS '$OSTYPE'"
			return 1
		fi
fi

# Check Miniconda download result
retVal=$?
if [[ retVal -ne 0 ]] ; then
	rm $MINICONDA
	echo "Can't download miniconda!"
	return 1
fi
chmod u+x $MINICONDA


INSTALL_DIR=$DIR/miniconda
if [ ! -e $INSTALL_DIR ]; then
  echo Installing miniconda
  $MINICONDA -b -p $INSTALL_DIR
fi
export PATH=${PATH}:${INSTALL_DIR}/bin

# Install node.js
NODE_VERSION=7.9.0
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
			curl -L $NODE_MACOS_URL -o $NODE_TAR
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

if [[ "$OSTYPE" == "darwin"* ]]; then
	# Try to update conda packages, because for macOS almost every dependency in the environment.yml is missing.
	echo "Updating conda"
	conda update conda
fi

# Install Python dependencies
if conda env list | grep -q "^dave[ ]\+"; then
  echo "dave virtual Python environment already exists"
else
  echo "Creating virtual Python environment dave"
  conda env create -f setup/environment.yml
  retVal=$?
  if [[ retVal -ne 0 ]] ; then
      echo "Failed to create virtual Python environment."
      return 1

# We can try to fix it by deleting the pip cache but the case so far I've seen, deleting the pip cache doens't solve it.
#      echo "Failed to create virtual Python environment. Deleting pip cache and try again."
#      if [[ "$OSTYPE" == "linux-gnu" ]]; then
#          rm -rf ~/.cache/pip
#      elif [[ "$OSTYPE" == "darwin"* ]]; then
#          rm -rf ~/Library/Caches/pip
#      fi
#      # retry installing
#      conda env remove -y -n dave
#      conda env create -f setup/environment.yml
#      retVal=$?
#      if [[ retVal -ne 0 ]] ; then
#          echo "Failed to create virtual Python environment on second attempt too. Bailing out."
#          return 1
#      fi
  fi

fi
source activate dave

if [[ "$OSTYPE" == "darwin"* ]]; then
    # Mac OSX
    # This is for MagicFile but only applies to macosx
    if [ ! -f /usr/local/bin/brew ]; then
        if [ -f /opt/local/bin/port ]; then
            echo "Installing LibMagic with MacPorts"
            yes | sudo /opt/local/bin/port install file
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
