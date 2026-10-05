# Disaster recovery

RPO<1h RTO<4h. RDS automated snapshots + PITR: restore via AWS console `rds:RestoreDBToPointInTime`. Redis: AOF persistence, ElastiCache backup. KMS: region-replicated keys. Escrow: funds safe on-chain; manual CLI fallback via stellar-sdk if API down.
