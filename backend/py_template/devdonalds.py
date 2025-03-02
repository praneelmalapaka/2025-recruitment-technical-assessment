from dataclasses import dataclass
from typing import List, Dict, Union
from flask import Flask, request, jsonify
import re

# ==== Type Definitions, feel free to add or modify ===========================
@dataclass
class CookbookEntry:
	name: str

@dataclass
class RequiredItem():
	name: str
	quantity: int

@dataclass
class Recipe(CookbookEntry):
	required_items: List[RequiredItem]

@dataclass
class Ingredient(CookbookEntry):
	cook_time: int


# =============================================================================
# ==== HTTP Endpoint Stubs ====================================================
# =============================================================================
app = Flask(__name__)

# Store your recipes here
cookbook = {}

# Task 1 helper (don't touch)
@app.route("/parse", methods=['POST'])
def parse():
	data = request.get_json()
	recipe_name = data.get('input', '')
	parsed_name = parse_handwriting(recipe_name)
	if parsed_name is None:
		return 'Invalid recipe name', 400
	return jsonify({'msg': parsed_name}), 200

# [TASK 1] ====================================================================
# Takes in a recipeName and returns it in a form that 
def parse_handwriting(recipeName: str) -> str:
    if not recipeName or not recipeName.strip():
        return None

    s = re.sub(r'[-_]+', ' ', recipeName)
    s = re.sub(r'[^a-zA-Z ]', '', s)

    words = s.split()
    if not words:
        return None

    return ' '.join(word.capitalize() for word in words)

# [TASK 2] ====================================================================
# Endpoint that adds a CookbookEntry to your magical cookbook
@app.route('/entry', methods=['POST'])
def create_entry():
    data = request.get_json(force=True)
    
    # Ensure data is a dict and has a non-empty string "name"
    if not data or not isinstance(data, dict):
        return '', 400
    if 'name' not in data or not isinstance(data['name'], str) or not data['name']:
        return '', 400
        
    # Ensure "type" is present as a string
    if 'type' not in data or not isinstance(data['type'], str):
        return '', 400

    name = data['name']
    entry_type = data['type']

    # Enforce unique names
    if name in cookbook:
        return '', 400

    # Validate entry type
    if entry_type not in ['recipe', 'ingredient']:
        return '', 400

    if entry_type == 'ingredient':
        # Ensure cookTime is present and valid
        if 'cookTime' not in data:
            return '', 400
        cook_time = data['cookTime']
        if not isinstance(cook_time, int) or cook_time < 0:
            return '', 400
        
        # Create and store the ingredient entry
        ingredient = {
            'type': 'ingredient',
            'name': name,
            'cookTime': cook_time
        }
        cookbook[name] = ingredient

    elif entry_type == 'recipe':
        # Ensure requiredItems is present and is a non-empty list
        if 'requiredItems' not in data:
            return '', 400
        required_items = data['requiredItems']
        if not isinstance(required_items, list) or not required_items:
            return '', 400

        cleaned_items = []
        seen = set()
        
        # Validate each required item
        for item in required_items:
            if not isinstance(item, dict) or 'name' not in item or 'quantity' not in item:
                return '', 400
            item_name = item['name']
            quantity = item['quantity']
            if not isinstance(item_name, str) or not item_name:
                return '', 400
            if not isinstance(quantity, int) or quantity <= 0:
                return '', 400
            if item_name in seen:
                return '', 400
            seen.add(item_name)
            cleaned_items.append({'name': item_name, 'quantity': quantity})
        
        # Create and store the recipe entry
        recipe = {
            'type': 'recipe',
            'name': name,
            'requiredItems': cleaned_items
        }
        cookbook[name] = recipe

    return '', 200

# [TASK 3] ====================================================================
# Endpoint that returns a summary of a recipe that corresponds to a query name
@app.route('/summary', methods=['GET'])
def summary():
    # Get the recipe name from query parameter.
    recipe_name = request.args.get('name')
    if not recipe_name:
        return '', 400

    entry = cookbook.get(recipe_name)
    # Must exist and be a recipe.
    if not entry or entry.get('type') != 'recipe':
        return '', 400

    def get_base_ingredients(name: str, multiplier: int):
        entry = cookbook.get(name)
        if not entry:
            return None
        if entry.get('type') == 'ingredient':
            return {name: multiplier}
        if entry.get('type') == 'recipe':
            base_map = {}
            for item in entry.get('requiredItems', []):
                child = cookbook.get(item.get('name'))
                if not child:
                    return None
                if child.get('type') == 'ingredient':
                    base_map[child['name']] = base_map.get(child['name'], 0) + item.get('quantity', 0) * multiplier
                elif child.get('type') == 'recipe':
                    sub_map = get_base_ingredients(child['name'], item.get('quantity', 0) * multiplier)
                    if sub_map is None:
                        return None
                    for ing, qty in sub_map.items():
                        base_map[ing] = base_map.get(ing, 0) + qty
            return base_map
        return None

    base_ingredients = get_base_ingredients(recipe_name, 1)
    if base_ingredients is None:
        return '', 400

    total_cook_time = 0
    ingredients_list = []

    for ing_name, qty in base_ingredients.items():
        ingredient = cookbook.get(ing_name)
        if not ingredient or ingredient.get('type') != 'ingredient':
            return '', 400
        total_cook_time += qty * ingredient.get('cookTime', 0)
        ingredients_list.append({'name': ing_name, 'quantity': qty})

    summary = {
        'name': recipe_name,
        'cookTime': total_cook_time,
        'ingredients': ingredients_list
    }
    return jsonify(summary), 200


# =============================================================================
# ==== DO NOT TOUCH ===========================================================
# =============================================================================

if __name__ == '__main__':
	app.run(debug=True, port=8080)
