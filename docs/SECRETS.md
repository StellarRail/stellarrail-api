# Secrets

Never commit secrets. Prod: AWS Secrets Manager + KMS (KMS_PROVIDER=aws, AWS_KMS_KEY_ID), or Vault transit (VAULT_ADDR). Startup refuses PRIVATE_KEY/MNEMONIC in prod. gitleaks in CI. Rotate quarterly.
