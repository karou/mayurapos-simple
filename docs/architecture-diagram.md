graph TD
    subgraph "Client Layer"
        MD[Mobile Devices]
        WB[Web Browsers]
        CT[Card Terminals]
    end
    
    subgraph "API Gateway Layer"
        AG[API Gateway] 
    end

    subgraph "Authentication"
        AS[Auth Service]
        AB[(Auth DB)]
    end

    subgraph "Core Services"
        PS[Payment Service]
        PB[(Payment DB)]
        OS[Order Service]
        OB[(Order DB)]
        IS[Inventory Service]
        IB[(Inventory DB)]
        DS[Delivery Service]
        DB[(Delivery DB)]
    end

    subgraph "Support Services"
        RS[Reporting Service]
        RB[(Reporting DB)]
        NS[Notification Service]
        NB[(Notification DB)]
    end

    subgraph "Integration Layer"
        RMQ[RabbitMQ]
        RC[Redis Cache]
    end

    subgraph "External Systems"
        PG[Payment Gateways]
        SI[Supplier Interfaces]
        SMS[SMS Provider]
        EM[Email Service]
    end

    MD -->|HTTPS| AG
    WB -->|HTTPS| AG
    CT -->|HTTPS| AG

    AG -->|Auth requests| AS
    AG -->|Payment requests| PS
    AG -->|Order requests| OS
    AG -->|Inventory requests| IS
    AG -->|Delivery requests| DS
    AG -->|Reporting requests| RS
    AG -->|Notification requests| NS

    AS -->|Store/Query| AB
    PS -->|Store/Query| PB
    OS -->|Store/Query| OB
    IS -->|Store/Query| IB
    DS -->|Store/Query| DB
    RS -->|Store/Query| RB
    NS -->|Store/Query| NB

    PS -->|Cache| RC
    OS -->|Cache| RC
    IS -->|Cache| RC
    DS -->|Cache| RC
    RS -->|Cache| RC
    NS -->|Cache| RC

    PS -->|Publish events| RMQ
    OS -->|Publish events| RMQ
    IS -->|Publish events| RMQ
    DS -->|Publish events| RMQ
    RS -->|Publish events| RMQ
    NS -->|Publish events| RMQ

    PS -->|Subscribe events| RMQ
    OS -->|Subscribe events| RMQ
    IS -->|Subscribe events| RMQ
    DS -->|Subscribe events| RMQ
    RS -->|Subscribe events| RMQ
    NS -->|Subscribe events| RMQ

    PS -->|Process payments| PG
    IS -->|Order supplies| SI
    NS -->|Send SMS| SMS
    NS -->|Send emails| EM

    classDef client fill:#D5E8D4,stroke:#82B366
    classDef gateway fill:#DAE8FC,stroke:#6C8EBF
    classDef service fill:#FFF2CC,stroke:#D6B656
    classDef db fill:#F5F5F5,stroke:#666666
    classDef integration fill:#FFE6CC,stroke:#D79B00
    classDef external fill:#E1D5E7,stroke:#9673A6

    class MD,WB,CT client
    class AG gateway
    class AS,PS,OS,IS,DS,RS,NS service
    class AB,PB,OB,IB,DB,RB,NB db
    class RMQ,RC integration
    class PG,SI,SMS,EM external