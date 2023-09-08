#!/bin/bash
set -euo pipefail

USERNAME=binaryigor

# Create user and setup passwordless sudo to simplify admin tasks
useradd --create-home --shell "/bin/bash" --groups sudo "${USERNAME}"
echo "${USERNAME} ALL=(ALL) NOPASSWD: ALL" | EDITOR='tee -a' visudo

# Create SSH directory for sudo user and move keys over
home_directory="$(eval echo ~${USERNAME})"
mkdir --parents "${home_directory}/.ssh"
cp /root/.ssh/authorized_keys "${home_directory}/.ssh"
chmod 0700 "${home_directory}/.ssh"
chmod 0600 "${home_directory}/.ssh/authorized_keys"
chown --recursive "${USERNAME}":"${USERNAME}" "${home_directory}/.ssh"

# Disable root SSH login with password
sed --in-place 's/^PermitRootLogin.*/PermitRootLogin no/g' /etc/ssh/sshd_config
if sshd -t -q; then systemctl restart ssh; fi

# Install docker & allow non sudo access
apt update
# install a few prerequisite packages which let apt use packages over HTTPS:
apt install apt-transport-https ca-certificates curl software-properties-common -y
# Then add the GPG key for the official Docker repository to your system
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
# Add the Docker repository to APT sources
add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu focal stable"
# This will also update our package database with the Docker packages from the newly added repo.
# Make sure you are about to install from the Docker repo instead of the default Ubuntu repo:
apt-cache policy docker-ce
# Finally, install Docker:
apt install docker-ce -y

# Allow non root access to a docker
usermod -aG docker ${USERNAME}
# limit docker logs size
echo '{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "20m",
    "max-file": "5"
  }
}' > /etc/docker/daemon.json
# Restart to use new config
systemctl restart docker