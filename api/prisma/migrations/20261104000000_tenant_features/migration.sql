ALTER TABLE tenants
ADD COLUMN features JSONB;

UPDATE tenants AS tenant
SET features = (
  SELECT jsonb_object_agg(feature.key, feature.enabled)
  FROM (
    SELECT item.key, bool_and(item.value = 'true'::jsonb) AS enabled
    FROM tenant_memberships AS membership
    JOIN users AS account ON account.id = membership.user_id
    CROSS JOIN LATERAL jsonb_each(
      CASE
        WHEN jsonb_typeof(account.features::jsonb) = 'object' THEN account.features::jsonb
        ELSE '{}'::jsonb
      END
    ) AS item
    WHERE membership.tenant_id = tenant.id
    GROUP BY item.key
  ) AS feature
)
WHERE EXISTS (
  SELECT 1
  FROM tenant_memberships AS membership
  JOIN users AS account ON account.id = membership.user_id
  WHERE membership.tenant_id = tenant.id AND account.features IS NOT NULL
);
