FROM node:12-buster

ENV DEBIAN_FRONTEND=noninteractive
SHELL [ "/bin/bash", "-c" ]
RUN apt-get update \
  && apt-get install -y bash-completion \
  && apt-get autoremove -y \
  && apt-get clean -y \
  && rm -rf /var/lib/apt/lists/*
RUN echo "source /etc/profile.d/bash_completion.sh" >> ~/.bashrc
RUN curl -fsL https://releases.hashicorp.com/terraform/0.12.29/terraform_0.12.29_linux_amd64.zip -o terraform_0.12.29_linux_amd64.zip \
  && unzip terraform_0.12.29_linux_amd64.zip \
  && mv terraform /usr/local/bin \
  && chmod +x /usr/local/bin/terraform
ENV DEBIAN_FRONTEND=dialog
