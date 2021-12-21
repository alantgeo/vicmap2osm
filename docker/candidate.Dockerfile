FROM debian:buster-slim
RUN apt-get -y update && apt-get -y install curl wget gnupg make git
RUN curl -fsSL https://deb.nodesource.com/setup_15.x | bash -
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list
RUN apt-get -y update && apt-get -y install nodejs yarn python3
RUN git clone https://github.com/grigory-rechistov/osm-bulk-upload.git upload && sed -i s/api\.openstreetmap\.org/master.apis.dev.openstreetmap.org/g upload/*.py
RUN wget -qO /usr/bin/b2 'https://github.com/Backblaze/B2_Command_Line_Tool/releases/latest/download/b2-linux' && chmod +x /usr/bin/b2
