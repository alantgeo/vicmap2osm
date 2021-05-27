FROM debian:buster-slim
RUN apt-get -y update && apt-get -y install curl gnupg make git
RUN curl -fsSL https://deb.nodesource.com/setup_15.x | bash -
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list
RUN apt-get -y update && apt-get -y install nodejs yarn python3
RUN git clone https://github.com/grigory-rechistov/osm-bulk-upload.git upload && sed -i s/api\.openstreetmap\.org/master.apis.dev.openstreetmap.org/g upload/*.py