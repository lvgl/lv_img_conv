FROM node:14

ENV PATH=/usr/src/app:$PATH

RUN mkdir -p /usr/src/app
COPY . /usr/src/app
RUN cd /usr/src/app && npm install typescript

VOLUME /usr/src/proj

WORKDIR /usr/src/proj

ENTRYPOINT ["entrypoint.sh"]

