FROM debian:bullseye-slim
RUN apt-get -y update && apt-get -y install wget markdown
RUN wget -qO /usr/bin/b2 'https://github.com/Backblaze/B2_Command_Line_Tool/releases/latest/download/b2-linux' && chmod +x /usr/bin/b2

