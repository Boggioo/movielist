from sentence_transformers import SentenceTransformer
import numpy as np
from flask import Flask, request, jsonify

app = Flask(__name__)
# Si utilizza un modello più grande per migliori risultati
model = SentenceTransformer('sentence-transformers/all-mpnet-base-v2')

@app.route('/recommend', methods=['POST'])
def recommend():
    query = request.json['query']
    movies = request.json['movies']
    
    # Si migliora la query aggiungendo contesto
    enhanced_query = f"Cerco un film che sia: {query}"
    
    # Crea embeddings per la query e i film
    query_embedding = model.encode(enhanced_query)
    movie_embeddings = model.encode([movie['description'] for movie in movies])
    
    # Calcola similarità
    similarities = np.dot(movie_embeddings, query_embedding) / \
                  (np.linalg.norm(movie_embeddings, axis=1) * np.linalg.norm(query_embedding))
    
    # Trova i film più simili con un punteggio minimo di similarità
    min_similarity = 0.3  # Soglia minima di similarità
    top_indices = np.argsort(similarities)[-10:]  # Si prendono più risultati
    recommendations = [
        movies[i] for i in reversed(top_indices)  # Si inverte l'ordine per avere i più rilevanti prima
        if similarities[i] > min_similarity
    ]
    
    return jsonify(recommendations[:5])  # Restitusce al massimo 5 risultati

if __name__ == '__main__':
    app.run(port=5000)