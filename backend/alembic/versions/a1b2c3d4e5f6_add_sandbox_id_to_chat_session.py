"""Add sandbox_id to chat_session

Revision ID: a1b2c3d4e5f6
Revises: fb123abc456
Create Date: 2026-09-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = 'fb123abc456'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('chat_sessions', sa.Column('sandbox_id', sa.String(), nullable=True))


def downgrade():
    op.drop_column('chat_sessions', 'sandbox_id')
