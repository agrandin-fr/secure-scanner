FROM --platform=linux/amd64 sonarsource/sonar-scanner-cli:latest

USER root

# Installation de git
RUN yum install -y git && yum clean all

# Création user/group
RUN groupadd scannergroup && \
    useradd -g scannergroup -m -s /bin/bash scanner

WORKDIR /usr/src

# On donne les droits du dossier de travail à l'utilisateur
RUN chown -R scanner:scannergroup /usr/src

# --- LE FIX EST ICI ---
# On force Sonar à écrire son cache dans notre dossier de travail, pas dans /opt
ENV SONAR_USER_HOME=/usr/src/.sonar

USER scanner

CMD ["sonar-scanner"]