# Super Shiba Minecraft Server Website

A web application for a Minecraft server featuring a live map (using Dynmap), player statistics, server resource monitoring, and mod information.
The project uses Docker, an nginx web server with SSL, and a Python Flask API.

A live demo is available [here](https://cyberintruder.ddns.net/)

### Features
- **Live Map**: Interactive Dynmap integration
- **Player Statistics**: Track player activity and stats
- **Resource Monitoring**: Real-time server CPU, RAM, and temperature monitoring
- **Responsive Design**: Works on desktop and mobile devices

## Setup Instructions

### Prerequisites
- Docker installed
- SSL certificates at `/etc/letsencrypt/`
- A minecraft server running with Dynmap
- HTML files modified to fit your server

### Directory Structure
Create the following directory structure on your server:
```
~/
├── api/
│   ├── .env
│   ├── api.py
│   ├── requirements.txt
│   └── Dockerfile
│       ...
├── website/
│   ├── index.html
│   └── theme.css
│       ...
├── nginx/
│   └── conf.d/
│       └── nginx.conf
├── minecraft-server/
│   └── ...
└── docker-compose.yml
```

### Configuration Files

#### 1. Example Docker Compose (`docker-compose.yml`)
```yaml
services:
  mcserver:
    image: itzg/minecraft-server:latest
    container_name: mcserver
    ports:
      - "25565:25565" # Your minecraft server port
      - "8123:8123" # Your dynmap port
    volumes:
      - ./minecraft-server:/data
    environment:
      EULA: "TRUE"
      # Other environment variables
    restart: unless-stopped
    networks:
      - webnet

  website:
    image: nginx:alpine
    container_name: website
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./website:/usr/share/nginx/html:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - /etc/letsencrypt/:/etc/letsencrypt/:ro
    restart: unless-stopped
    networks:
      - webnet

  api:
    build: ./api
    container_name: api
    ports:
      - "5000:5000"
    restart: unless-stopped
    privileged: true
    pid: "host"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /sys/class/thermal:/sys/class/thermal:ro
      - ./minecraft-server:/mcserver:ro
    networks:
      - webnet

networks:
  webnet:
    driver: bridge
```

#### 2. Example API Dockerfile (`api/Dockerfile`)
```dockerfile
FROM python:3.11-slim

RUN apt update && \
    apt install -y gcc python3-dev && \
    apt clean

WORKDIR /api

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY .env ./
COPY *.py ./

CMD ["python", "api.py"]
```

#### 3. Nginx Configuration (`nginx/conf.d/nginx.conf`)
```nginx
server {
    listen 443 ssl;
    server_name <your domain here>;

    ssl_certificate /etc/letsencrypt/live/<your domain here>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<your domain here>/privkey.pem;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location /map/dynmap/ {
        proxy_pass http://mcserver:8123/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /api/ {
        proxy_pass http://api:5000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_http_version 1.1;
    }
}

server {
    listen 80;
    server_name <your domain here>;

    location / {
        return 301 https://$host$request_uri;
    }
}
```

### Deployment

1. Copy the project files to your server
2. Update configuration:
   - Replace `<your domain here>` in `nginx/conf.d/nginx.conf` with your actual domain
3. Start the services:
   ```bash
   docker-compose up -d
   ```

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.