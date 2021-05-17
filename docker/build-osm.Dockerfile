FROM debian:unstable-slim
RUN apt-get -y update && apt-get -y install curl gnupg make wget unzip gdal-bin osmium-tool software-properties-common
RUN curl -fsSL https://deb.nodesource.com/setup_12.x | bash -
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list
RUN apt-get -y update && apt-get -y install nodejs yarn
RUN wget -qO - https://qgis.org/downloads/qgis-2020.gpg.key | gpg --no-default-keyring --keyring gnupg-ring:/etc/apt/trusted.gpg.d/qgis-archive.gpg --import
RUN chmod a+r /etc/apt/trusted.gpg.d/qgis-archive.gpg
RUN add-apt-repository "deb https://qgis.org/debian unstable main"
RUN apt-get -y update && apt-get -y install qgis
