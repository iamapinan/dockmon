FROM alpine:3.21
WORKDIR /
COPY build/dockmon /dockmon

VOLUME ["/dockmon_data"]
EXPOSE 8090

ENTRYPOINT ["/dockmon"]
CMD ["serve", "--http=0.0.0.0:8090", "--dir=/dockmon_data"]
