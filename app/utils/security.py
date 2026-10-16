from functools import wraps
from flask import session, redirect, url_for, request, jsonify, abort

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("user_id"):
            if request.is_json or request.path.startswith("/api/"):
                return jsonify({"error": "Authentication required."}), 401
            return redirect(url_for("auth.login"))
        return f(*args, **kwargs)
    return decorated_function
