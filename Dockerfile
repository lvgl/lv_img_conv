FROM ubuntu:20.04

ENV PATH=/usr/src/app:$PATH

RUN mkdir -p /usr/src/app
RUN apt update
RUN DEBIAN_FRONTEND=noninteractive TZ=Etc/UTC apt-get -y install tzdata
RUN apt install -y gcc make g++ pkg-config libpixman-1-dev libcairo2-dev libpango1.0-dev libjpeg8-dev libgif-dev nodejs npm imagemagick
RUN npm install -g ts-node
COPY . /usr/src/app
RUN cd /usr/src/app && npm install

VOLUME /usr/src/proj

WORKDIR /usr/src/proj

ENTRYPOINT ["entrypoint.sh"]
