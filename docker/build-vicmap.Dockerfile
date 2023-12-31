FROM debian:bullseye-slim
RUN apt-get -y update && apt-get -y install curl wget gnupg make gdal-bin
RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list
RUN apt-get -y update && apt-get -y install nodejs yarn
RUN wget -qO /usr/bin/b2 'https://github.com/Backblaze/B2_Command_Line_Tool/releases/latest/download/b2-linux' && chmod +x /usr/bin/b2

