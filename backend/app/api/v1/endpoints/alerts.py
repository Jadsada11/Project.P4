from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.alert import Alert
from app.schemas.alert import AlertResponse, AlertUpdateRead

router = APIRouter()


@router.get("", response_model=List[AlertResponse], summary="ดึงรายการแจ้งเตือนทั้งหมด")
def get_alerts(
    category: Optional[str] = Query(None, description="กรองตามประเภท: 'household', 'delivery', 'stranger'"),
    unread_only: bool = Query(False, description="เฉพาะรายการที่ยังไม่อ่าน"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """
    เรียกดูรายการแจ้งเตือนด้านความปลอดภัยและการตรวจพบบุคคล
    เรียงจากเหตุการณ์ล่าสุด
    """
    query = db.query(Alert)

    if category and category.strip() and category.upper() != "ALL":
        query = query.filter(Alert.category == category.lower())

    if unread_only:
        query = query.filter(Alert.is_read == False)

    alerts = (
        query.order_by(Alert.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return alerts


@router.get("/unread-count", summary="ดึงจำนวนแจ้งเตือนที่ยังไม่ได้อ่าน")
def get_unread_alerts_count(db: Session = Depends(get_db)):
    """
    คืนค่าจำนวนรายการแจ้งเตือนที่ is_read == False
    """
    count = db.query(Alert).filter(Alert.is_read == False).count()
    return {"unread_count": count}


@router.put("/read-all", summary="ทำเครื่องหมายว่าอ่านแล้วทั้งหมด")
def mark_all_alerts_read(db: Session = Depends(get_db)):
    """
    ทำเครื่องหมายว่าอ่านแล้วสำหรับแจ้งเตือนที่ยังไม่ได้อ่านทั้งหมด
    """
    db.query(Alert).filter(Alert.is_read == False).update({"is_read": True})
    db.commit()
    return {"message": "All alerts marked as read"}


@router.put("/{alert_id}/read", response_model=AlertResponse, summary="เปลี่ยนสถานะการอ่านของแจ้งเตือน")
def update_alert_read(
    alert_id: int,
    body: Optional[AlertUpdateRead] = None,
    db: Session = Depends(get_db),
):
    """
    เปลี่ยนสถานะเป็นอ่านแล้วหรือยังไม่ได้อ่าน
    """
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    if body is not None:
        alert.is_read = body.is_read
    else:
        alert.is_read = not alert.is_read

    db.commit()
    db.refresh(alert)
    return alert


@router.delete("", summary="ลบการแจ้งเตือนทั้งหมด หรือตามเงื่อนไข")
def clear_alerts(
<<<<<<< HEAD
    category: Optional[str] = Query(None, description="กรองตามประเภท: 'household', 'delivery', 'stranger'"),
    unread_only: bool = Query(False, description="ลบเฉพาะรายการที่ยังไม่ได้อ่าน"),
=======
    category: Optional[str] = Query(None, description="กรองลบเฉพาะประเภท: 'household', 'delivery', 'stranger'"),
>>>>>>> 260fd4a03c97f6988bbee365acab77fd6d4d31f2
    read_only: bool = Query(False, description="ลบเฉพาะรายการที่อ่านแล้ว"),
    db: Session = Depends(get_db),
):
    """
<<<<<<< HEAD
    ลบรายการแจ้งเตือนทั้งหมด หรือเลือกลบตามหมวดหมู่ / สถานะการอ่าน
=======
    ลบรายการแจ้งเตือนทั้งหมด หรือกรองตามหมวดหมู่ หรือลบเฉพาะที่อ่านแล้ว
>>>>>>> 260fd4a03c97f6988bbee365acab77fd6d4d31f2
    """
    query = db.query(Alert)
    if category and category.strip() and category.upper() != "ALL":
        query = query.filter(Alert.category == category.lower())
<<<<<<< HEAD
    if unread_only:
        query = query.filter(Alert.is_read == False)
    elif read_only:
        query = query.filter(Alert.is_read == True)

    deleted_count = query.delete(synchronize_session=False)
    db.commit()
    return {"message": f"Deleted {deleted_count} alerts", "count": deleted_count}
=======
    if read_only:
        query = query.filter(Alert.is_read == True)

    records = query.all()
    deleted_count = len(records)
    for a in records:
        db.delete(a)
    db.commit()
    return {
        "message": f"ลบการแจ้งเตือนสำเร็จ {deleted_count} รายการ",
        "deleted_count": deleted_count,
    }
>>>>>>> 260fd4a03c97f6988bbee365acab77fd6d4d31f2


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT, summary="ลบการแจ้งเตือน")
def delete_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    db.delete(alert)
    db.commit()
    return None

