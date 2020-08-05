FROM node:12-buster

ENV DEBIAN_FRONTEND=noninteractive
SHELL [ "/bin/bash", "-c" ]
RUN apt-get update \
  && apt-get install -y bash-completion \
  && apt-get autoremove -y \
  && apt-get clean -y \
  && rm -rf /var/lib/apt/lists/*
RUN echo "source /etc/profile.d/bash_completion.sh" >> ~/.bashrc
ENV DEBIAN_FRONTEND=dialog
